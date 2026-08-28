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

## Container runtime: Docker vs. Singularity

Set at startup via `EDGE_CONTAINER_SERVICE`, and also changeable live
without restarting — `neuroflame edge get-container-service` /
`set-container-service <docker|singularity>` from the CLI mutate this
process's in-memory config directly (`runStart.ts` reads it fresh on every
run, not a value cached at startup). That live change does **not** persist
across this process restarting; it reverts to whatever `EDGE_CONTAINER_SERVICE`
says (env var / systemd unit) the next time it starts.

## A typical headless setup

On the compute node:

```bash
npm install -g edge-federated-client
EDGE_HTTP_URL=... EDGE_WS_URL=... EDGE_BASE_DIR=... EDGE_HOSTING_PORT=4001 \
  neuroflame-edge start
# or install the systemd unit for it to survive reboots/crashes
```

From `cliAppClient`, on that same node (or anywhere with network access to
it):

```bash
npm install -g @neuroflame/cli
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
