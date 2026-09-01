# NeuroFLAME Edge Federated Client

The edge federated client runs on a compute site — a researcher's
workstation, or a headless machine on an HPC cluster — and executes
computation containers (Docker or Singularity/Apptainer) when central
starts a run for a consortium this site is participating in. It exposes a
small local GraphQL + REST API (mount directory, local parameters, run
results, container runtime) that a controlling client talks to.

Two things can act as that controlling client:

- The **desktop app** (`desktopApp/electronApp`), which embeds this
  package directly — it calls `start()` in-process and drives the local
  API from its own UI. This is the only way this package has historically
  been run.
- **`cliAppClient`** (`neuroflame`/`nf`)'s `edge` commands, talking to
  this package's API over HTTP the same way the desktop app's UI does —
  see its README's ["Pointing a consortium at a local dataset
  directory"](../cliAppClient/README.md#pointing-a-consortium-at-a-local-dataset-directory)
  section.

This package now also runs **standalone** — as a plain Node process, no
Electron involved at all — which is what makes a truly headless HPC/cluster
deployment possible: `neuroflame-edge` on the compute node, driven entirely
by `neuroflame`/`nf` from wherever you're working.

## Install

```bash
npm install -g edge-federated-client
```

The global command is:

```bash
neuroflame-edge
```

## Configure

Configuration is read from environment variables:

```bash
export EDGE_HTTP_URL=http://your-central-api.example.com:3001/graphql
export EDGE_WS_URL=ws://your-central-api.example.com:3001/graphql
export EDGE_BASE_DIR=/var/lib/neuroflame/edge/work
export EDGE_HOSTING_PORT=4001
```

Use `http`/`ws` for a raw central API port, `https`/`wss` only if it's
behind TLS termination. `EDGE_BASE_DIR` holds downloaded run kits,
mount-dir/local-params config, Singularity images (if used), and run
results. `EDGE_HOSTING_PORT` is the port *this* process listens on — what
`NEUROFLAME_EDGE_URL` (or `neuroflame configure`) on the CLI side should
point at.

Optional:

```bash
export EDGE_AUTHENTICATION_ENDPOINT=http://your-central-api.example.com:3001/authenticateToken
export EDGE_LOG_PATH=/var/log/neuroflame/edge
export EDGE_CONTAINER_SERVICE=docker   # or singularity
```

`EDGE_AUTHENTICATION_ENDPOINT` defaults to `EDGE_HTTP_URL` with `/graphql`
replaced by `/authenticateToken` — every deployment we've seen colocates
them, so only set this if yours genuinely doesn't. `EDGE_CONTAINER_SERVICE`
defaults to `docker`; requires Singularity or Apptainer to actually be
installed on this machine if set to `singularity` (`which singularity
apptainer`). It's also settable live, without restarting, once the process
is running — see [Container runtime](#container-runtime-docker-vs-singularity)
below.

## Start

```bash
neuroflame-edge start
```

Brings up the GraphQL (queries/mutations) + WS (subscriptions) endpoint on
`EDGE_HOSTING_PORT`, and a `/run-results` REST API alongside it. It does
**not** automatically start participating in runs — a controlling client
still has to call `connectAsUser` (`neuroflame edge connect`) with a valid
access token before this process subscribes to central and starts picking
up runs. That's deliberate: the same process can sit idle, configured but
not yet "logged in" as anyone, until a client tells it who it's acting as.

## Commands

```bash
neuroflame-edge start
neuroflame-edge validate
neuroflame-edge env
neuroflame-edge systemd-template [--force]
```

Validate required environment:

```bash
neuroflame-edge validate
```

Print the effective environment:

```bash
neuroflame-edge env
```

Write a systemd service template into the current directory:

```bash
neuroflame-edge systemd-template
```

## systemd

```bash
neuroflame-edge systemd-template
```

Edit `./neuroflame-edge.service` and replace the inline `Environment=`
examples with real values. Then:

```bash
sudo cp ./neuroflame-edge.service /etc/systemd/system/neuroflame-edge.service
sudo systemctl daemon-reload
sudo systemctl enable neuroflame-edge
sudo systemctl start neuroflame-edge
```

View logs:

```bash
journalctl -u neuroflame-edge -f
```

### When this process exits on its own

This process holds one access token in memory, set once whenever
something calls `connectAsUser` (`neuroflame edge connect`/`edge start`,
or the desktop app's own login flow) — it's never refreshed on its own.
That token is normally only used to answer requests *to* this process; a
successful run never needs it at all, since run completion is reported
by the coordinator, not this process. The one place it *does* use that
stored token itself is reporting a run failure back to `centralApi`
(`reportRunError`) when a container fails locally.

If that call finds no token stored, or `centralApi` rejects it as
unauthorized (401/403) — meaning this process's own session has actually
gone bad, not just a one-off network hiccup — **this process logs the
reason and exits**, rather than continuing to run in a state where it can
never successfully report a failure again. A non-auth failure there
(a 500, a dropped connection) does *not* trigger this — only centralApi
specifically rejecting the stored token does.

**Under systemd, `Restart=always` brings the process back — it does not
by itself fix the identity problem that caused the exit.** A fresh
process still starts with no token until something calls `connectAsUser`
again. If this keeps happening, whatever's driving this edge client
(the CLI, a script, the desktop app) needs to reconnect it
(`neuroflame edge connect`/`edge start`) after a restart, not just count
on the process being alive.

**Exiting is only correct for a standalone process, though — it's
overridable, and needs to be overridden by anything that embeds this
package in-process rather than running it as its own OS process.** The
desktop app is exactly that case: it calls `start()` directly inside
Electron's main process, not as a spawned child, so the default behavior
here would silently take the *entire desktop app* down with it, not just
"the edge client part." `start()`'s second argument covers this:

```ts
import { start } from 'edge-federated-client'

start(config, {
  onStaleSession: (reason) => {
    // Show your own UI, log out, whatever makes sense for how you're
    // embedding this — anything except letting the default (exit the
    // process) run, if this process is more than just this package.
  },
})
```

The desktop app uses this to show a "session expired, please log back
in" dialog instead of exiting — see `showSessionExpiredError` in its
`main.ts`.

## Container runtime: Docker vs. Singularity

Set at startup via `EDGE_CONTAINER_SERVICE`, and also changeable live
without restarting — `neuroflame edge get-container-service` /
`set-container-service <docker|singularity>` from the CLI mutate this
process's in-memory config directly (`runStart.ts` reads it fresh on every
run, not a value cached at startup). That live change does **not** persist
across this process restarting; it reverts to whatever `EDGE_CONTAINER_SERVICE`
says (env var / systemd unit) the next time it starts.

## A typical headless setup

**The easy way:** this package is a bundled dependency of `cliAppClient`
now, not something you install separately — `neuroflame edge start` spawns
it for you. On the compute node — not yet published to npm, so install
from a checkout (see [cliAppClient's
README](../cliAppClient/README.md#install)):

```bash
git clone https://github.com/NeuroFlame/NeuroFLAME.git
cd NeuroFLAME/cliAppClient && npm run init
neuroflame login
neuroflame edge start     # spawns this package as its own process, connects
neuroflame edge set-mount-dir <consortiumId> /path/to/local/dataset
neuroflame consortium set-ready <consortiumId> true
neuroflame run watch-consortium <consortiumId> --latest
```

**Minimal footprint, no CLI control-plane commands at all:** install and
run this package directly instead —

```bash
npm install -g edge-federated-client
EDGE_HTTP_URL=... EDGE_WS_URL=... EDGE_BASE_DIR=... EDGE_HOSTING_PORT=4001 \
  neuroflame-edge start
# or install the systemd unit for it to survive reboots/crashes
```

— then drive it from `cliAppClient` running anywhere with network access
to it (not necessarily the same node):

```bash
git clone https://github.com/NeuroFlame/NeuroFLAME.git
cd NeuroFLAME/cliAppClient && npm run init
neuroflame configure       # point NEUROFLAME_EDGE_URL at this node's :4001
neuroflame login --connect-edge
neuroflame edge set-mount-dir <consortiumId> /path/to/local/dataset
neuroflame consortium set-ready <consortiumId> true
neuroflame run watch-consortium <consortiumId> --latest
```

No Electron, no display, no GUI anywhere in that sequence.

## Local development

```bash
npm install
npm run compile
EDGE_HTTP_URL=http://localhost:3001/graphql \
EDGE_WS_URL=ws://localhost:3001/graphql \
EDGE_BASE_DIR=/tmp/neuroflame-edge/work \
EDGE_HOSTING_PORT=4001 \
npm start
```
