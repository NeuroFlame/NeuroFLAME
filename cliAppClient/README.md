# NeuroFLAME CLI (`cliAppClient`)

A terminal client for NeuroFLAME's central API — the headless equivalent of
the desktop app's control panel (login, browse/join consortia, start and
watch runs), for environments where a GUI isn't an option, like an HPC
cluster reached only over SSH.

This CLI only replaces the *control plane*. Actual computation execution on
a cluster still runs through `edgeFederatedClient` or `vaultFederatedClient`
(both already headless, both already support Docker and Singularity) — this
tool triggers and monitors runs, it doesn't execute them.

Every human-facing operation in `centralApi`'s GraphQL schema has a command
here — auth, consortia, computations, study setup, runs, and vault/admin
management. Deliberately **not** included: `vaultHeartbeat`, `reportRun*`,
and the `runStartCentral`/`runStartEdge` subscriptions — those are used
internally by `edgeFederatedClient`/`vaultFederatedClient`, not by a human
operator.

One resource, `edge`, is the exception to "talks to centralApi": it talks to
the local edge client instead, for the one thing that's inherently
per-machine rather than central — which local folder to use as a
consortium's dataset directory. See [Pointing a consortium at a local
dataset directory](#pointing-a-consortium-at-a-local-dataset-directory).

## Getting Started

This CLI only replaces the control plane (auth, consortia, runs). Actually
*executing* a computation on this machine takes an edge client too — either
this CLI managing one directly (step 4 below), or the desktop app running
here instead (it starts one for you on login). **Skip step 4** if you're
only doing control-plane work from a node that isn't running any
computations itself (admin tasks, watching runs, managing a consortium
remotely) — everything else still works without an edge client anywhere
nearby.

```bash
# 1. Install both — the CLI, and the edge client it drives
npm install -g @neuroflame/cli
npm install -g edge-federated-client

# 2. Point the CLI at your central API — interactive, checks it live
#    before saving
neuroflame configure

# 3. Log in
neuroflame login

# 4. Spawn a local edge client, tracked by this CLI, connected as you,
#    with a mount-dir check for every consortium you're a member of —
#    skip if you're not running computations on this machine
neuroflame edge start

# 5. Try it
neuroflame consortium list
```

`edge start` replaces what used to be a separate `neuroflame-edge start`
in its own terminal (with `EDGE_HTTP_URL`/`EDGE_BASE_DIR`/etc. set by
hand) plus a manual `edge connect` — it spawns the daemon itself, tracks
it by PID so a later `edge start` reconnects instead of double-spawning,
points this CLI's config at it, and connects as whoever's logged in, all
in one step. See [Running a standalone edge
client](#running-a-standalone-edge-client) for the full flag list
(`--base-dir`/`--port`/`--container-service`), `neuroflame edge stop` to
tear it down, and the manual env-var form it uses under the hood — still
the way to go for a genuinely distributed setup (the edge daemon on a
different machine than wherever you run `neuroflame` from), or under
systemd for anything long-lived.

**Running this alongside the desktop app, or a second identity, on the
*same* machine?** Each edge client needs its own port *and* its own base
dir — never reuse the desktop app's port (`3003` in a typical local
config). An edge client only tracks a single logged-in identity at a
time; two clients sharing a port means the second login silently steals
the connection from the first, and whichever identity got bumped never
actually participates in a run — no error anywhere, it just quietly never
joins. `edge start`'s default port (`4001`, `neuroflame-edge`'s own
shipped default) is a safe choice precisely because nothing else defaults
to it — pass `--port <n>` for a second one on the same box.

From there:

- **Joining or setting up a consortium?** `neuroflame consortium wizard`
  walks you through it interactively, the terminal equivalent of the
  desktop app's own setup wizard — see [Guided setup: the
  wizard](#guided-setup-the-wizard).
- **Edge client running somewhere else, or on a non-default port?** See
  [Running a standalone edge
  client](#running-a-standalone-edge-client) for the full option list,
  and [Pointing a consortium at a local dataset
  directory](#pointing-a-consortium-at-a-local-dataset-directory) for what
  to do once it's up.
- **Something not working?** `neuroflame status` shows exactly what's
  configured, where each value came from, and whether it's reachable right
  now — see [Setup and diagnostics](#setup-and-diagnostics).
- **Looking for a specific command?** See [Commands](#commands) for the
  full reference.

## Install

```bash
npm install -g @neuroflame/cli
```

Installs two equivalent global commands — use whichever you prefer:

```bash
neuroflame
nf          # short alias, same binary
```

## Setup and diagnostics

```bash
neuroflame configure   # stepped, interactive: checks each URL live, then saves it
neuroflame status [--json]   # on-demand: what's configured, where it came from, is it up
```

Run `configure` once per machine. It prompts for the central API URL (and
derives the WS URL from it), then optionally the local edge client's URL,
checking each one actually responds before accepting it, and saves them to
`~/.config/neuroflame-cli/config.json` — so they stick across shell
sessions without exporting env vars every time. `status` is the read-only
companion: run it anytime (or first, out of habit) to see exactly what
you're pointed at and whether it's reachable right now, without changing
anything.

Both exist because of a real, repeated failure mode: `edge` commands default
to `http://localhost:4001` (`edgeFederatedClient`'s own shipped default)
when nothing else says otherwise, which is very often *not* where your
actual edge client is listening (`3003` in a typical local dev setup, say)
— and the failure without either of these commands was an opaque `fetch
failed` deep inside whatever command you were trying to run, with no
indication *why*. `configure` fixes it once; `status` tells you if
something's still wrong and, critically, *why* (wrong port vs. server not
running vs. wrong host).

Full resolution order for every URL, highest priority first: an explicit
per-command `--url` flag → an env var (`NEUROFLAME_HTTP_URL`,
`NEUROFLAME_WS_URL`, `NEUROFLAME_EDGE_URL`) → the server a saved session
was logged into (central API only) → the persisted `configure` value →
a hardcoded `localhost` default. Env vars always win, so scripts/CI can
still override per-invocation without touching persisted config:

```bash
export NEUROFLAME_HTTP_URL=http://your-central-api.example.com:3001/graphql
export NEUROFLAME_WS_URL=ws://your-central-api.example.com:3001/graphql
```

Use `http`/`ws` for a raw central API port, `https`/`wss` only if it's
behind TLS termination.

## Login

```bash
neuroflame login
Username: alice
Password:
Logged in as alice (roles: member)
Server: http://your-central-api.example.com:3001/graphql
```

Non-interactive (for scripts/CI):

```bash
NEUROFLAME_USERNAME=alice NEUROFLAME_PASSWORD=hunter2 neuroflame login
# or
neuroflame login --username alice --password hunter2
```

A third way, for a context where exporting real env vars isn't practical —
a SLURM batch job, systemd, anywhere without an easy way to inject
secrets into the job's own environment: drop them in
`~/.config/neuroflame-cli/.env` (`chmod 600` it — it holds a password)
and they're picked up automatically, no flags or exports needed:

```bash
# ~/.config/neuroflame-cli/.env
NEUROFLAME_USERNAME=alice
NEUROFLAME_PASSWORD=hunter2
```

Any `NEUROFLAME_*` variable this CLI reads works here, not just login
credentials — `NEUROFLAME_HTTP_URL`, `NEUROFLAME_EDGE_URL`, etc. Real
environment variables always win over the file, same precedence as
everywhere else in this CLI (env var > persisted config > default) — a
one-off `export` still overrides it.

If neither a terminal nor full credentials (flag, env var, or `.env`
file) are available, `login` fails immediately with a clear error rather
than hanging — without this, a batch job with nothing to prompt on would
otherwise sit forever waiting for a line on a stdin that will never
produce one, silently burning its whole time allocation.

The access token and the server it belongs to are saved to
`~/.config/neuroflame-cli/session.json`, mode `0600`. `neuroflame logout`
deletes it.

If you're logging in on the machine that's also running this identity's edge
client, add `--connect-edge` to also bring that client online in the same
step (see [Pointing a consortium at a local dataset
directory](#pointing-a-consortium-at-a-local-dataset-directory) for why this
is a separate step at all):

```bash
neuroflame login --connect-edge
neuroflame login --connect-edge --url http://localhost:3004/graphql   # non-default edge port
```

This is opt-in and best-effort on purpose — most CLI usage (admin work,
consortium management, `run start`/`watch` from a control node) has no edge
client anywhere nearby, so attempting this unconditionally on every login
would throw a connection error at everyone who isn't doing edge-client work.
Without `--connect-edge`, login never touches the edge client. With it, a
failed connection attempt prints a warning but doesn't fail the login.

## Commands

```bash
neuroflame whoami

neuroflame user create <username> <password>
neuroflame user change-password <newPassword>
neuroflame user request-password-reset <username>
neuroflame user reset-password <token> <newPassword>

neuroflame consortium wizard [consortiumId]   # guided setup — see below
neuroflame consortium list [--json]
neuroflame consortium show <consortiumId> [--json]
neuroflame consortium create <title> [--description <text>] [--private]
neuroflame consortium edit <consortiumId> <title> <description> [--private]
neuroflame consortium join <consortiumId>
neuroflame consortium join-by-invite <token>
neuroflame consortium leave <consortiumId>
neuroflame consortium delete <consortiumId>
neuroflame consortium invite <consortiumId> <email>
neuroflame consortium invite-info <token> [--json]
neuroflame consortium set-active <consortiumId> <true|false>
neuroflame consortium set-ready <consortiumId> <true|false>
neuroflame consortium add-vault <consortiumId> <vaultId>
neuroflame consortium remove-vault <consortiumId> <vaultId>
neuroflame consortium set-vault-active <consortiumId> <vaultId> <true|false>
neuroflame consortium set-member-inactive <consortiumId> <userId> <true|false>
neuroflame consortium remove-member <consortiumId> <userId>
neuroflame consortium add-vault-user <consortiumId> <userId>
neuroflame consortium watch <consortiumId> [--json]   # streams updates until Ctrl+C

neuroflame computation list [--json]
neuroflame computation show <computationId> [--json]
neuroflame computation create <title> <imageName> <imageDownloadUrl> <notes> [--has-local-parameters]
neuroflame computation edit <computationId> <title> <imageName> <imageDownloadUrl> <notes> [--has-local-parameters]

neuroflame study set-computation <consortiumId> <computationId>
neuroflame study set-parameters <consortiumId> <parametersJson|@file>   # @file reads JSON from a file
neuroflame study set-notes <consortiumId> <notes>

neuroflame run start <consortiumId> [--wait] [--json]
neuroflame run list [consortiumId] [--latest] [--json]
neuroflame run show <runId> [--json]
neuroflame run watch <runId> [--json]                     # a specific run, until it's Complete/Error
neuroflame run watch-consortium <consortiumId> [--latest] [--json]  # whichever run(s) a consortium has, live
neuroflame run delete <runId>

neuroflame vault my-config [--json]     # for a vault-role user inspecting its own config
neuroflame vault my-server [--json]
neuroflame vault list-users [--json]
neuroflame vault list-servers [--json]
neuroflame vault list-hosted [serverId] [--json]

neuroflame edge start [--base-dir <path>] [--port <n>] [--container-service docker|singularity]
neuroflame edge stop
neuroflame edge connect [--url <edgeUrl>]
neuroflame edge get-mount-dir <consortiumId> [--json]
neuroflame edge set-mount-dir <consortiumId> <path>
neuroflame edge get-local-params <consortiumId> <mountDir>
neuroflame edge set-local-params <consortiumId> <mountDir> <paramsJson|@file>
neuroflame edge list-results <consortiumId> <runId> [participantId] [--json]
neuroflame edge download-results <consortiumId> <runId> [participantId] [--out <file>]
neuroflame edge open-results <consortiumId> <runId> [participantId]
neuroflame edge get-run-error <consortiumId> <runId> [participantId] [--json]
neuroflame edge get-container-service [--json]
neuroflame edge set-container-service <docker|singularity>

neuroflame admin create-vault-user <username> <password>
neuroflame admin set-roles <username> <role...>
neuroflame admin set-password <username> <password>
neuroflame admin set-vault-computations <userId> <computationId...>
neuroflame admin set-vault-datasets <userId> <computationId:datasetKey...>
neuroflame admin create-hosted-vault <serverId> <name> <description> <datasetKey>
neuroflame admin update-hosted-vault <vaultId> <name> <description>
neuroflame admin set-hosted-vault-computations <vaultId> <computationId...>
```

Admin/leader commands are gated server-side by role the same way the desktop
app's UI gates them — the CLI doesn't do its own authorization, a call just
fails if the logged-in user lacks the role.

`run start --wait` (or `run watch` on its own) prints each status
transition — `Provisioning` → `Starting` → `In Progress` → `Complete`/`Error`
— and exits `0` on `Complete` or `1` on `Error`, so it's usable as the last
step of a batch script:

```bash
runId=$(neuroflame run start "$CONSORTIUM_ID" --json | jq -r .runId)
neuroflame run watch "$runId" --json | tee run.log
```

## Pointing a consortium at a local dataset directory

In the desktop app, a consortium's page has a "Data Directory" panel: browse
to a local folder, and a Ready toggle. `edge set-mount-dir` is the CLI
version of that — it's a purely local, per-machine setting ("use this folder
for this consortium's runs on this machine"), not something centralApi
tracks. It has nothing to do with the `vault` commands above, which are
about a separate role (hosting a dataset centrally for a consortium to
discover) — this is just telling your own machine which folder to mount in
when it runs a computation for a consortium you're a member of.

Run it on whichever machine is actually doing the computation — the same
machine the "Data Directory" GUI panel would run on. That machine doesn't
have to be running the desktop app at all: `edgeFederatedClient` (the
`edge-federated-client` npm package) now runs standalone as a plain
`neuroflame-edge` process, no Electron/GUI anywhere — see [its
README](../edgeFederatedClient/README.md) for a full headless HPC/cluster
setup. Every `edge` command here works identically against either one,
since both expose the same local API.

### Running a standalone edge client

Before any `edge` command here can do anything, *something* has to be
listening on the edge URL — either the desktop app (which starts one
in-process on login), or `neuroflame-edge` running on its own. `neuroflame
status` shows `NOT reachable` on the edge line if nothing is.

#### The easy way: let the CLI manage it

```bash
npm install -g edge-federated-client   # once, so `neuroflame-edge` exists
neuroflame edge start                  # spawns it, connects, checks mount dirs
```

`neuroflame edge start` spawns `neuroflame-edge` itself (using this CLI's
own configured central API), tracks it by PID
(`~/.config/neuroflame-cli/edge-daemon.pid`), points this CLI's config at
it, connects as whoever's logged in, and runs the mount-dir preflight —
one command instead of a second terminal running `neuroflame-edge start`
by hand and a separate `edge connect`. Run it again anytime (even in a
new shell) and it reconnects to the same daemon rather than spawning a
second one; `neuroflame edge stop` shuts it down.
`--base-dir <path>`/`--port <n>`/`--container-service docker|singularity`
override the defaults (`~/.config/neuroflame-cli/edge-data`, `4001`,
`docker`) — omit them on a later `edge start` and it reuses whatever was
used last time.

This is genuinely convenient, and it directly targets a real, repeated
failure mode from actual production testing: the edge daemon getting
restarted (a crash, a `docker system prune`-adjacent cleanup, closing the
terminal it was running in) and silently losing its `connectAsUser`
subscription — invisible until a run starts and only one site's container
ever shows up. **It only helps when the CLI and the edge daemon belong on
the same machine, though** — the common single-workstation case. It does
not change anything about `edgeFederatedClient` itself, and it deliberately
doesn't merge the two packages: `cliAppClient` still just shells out to a
separately-installed `neuroflame-edge` binary, so control-plane-only CLI
usage (the common case per the intro above) never pulls in Docker/Apollo/
Express — it only reaches for `neuroflame-edge` when you actually ask it
to. For a genuinely distributed setup — the edge daemon on a different
node than wherever you run `neuroflame` from, which is the normal shape
on an actual HPC cluster — start it manually there instead, the same way
`neuroflame edge start` does under the hood:

```bash
EDGE_HTTP_URL=https://your-central-api.example.com/graphql \
EDGE_WS_URL=wss://your-central-api.example.com/graphql \
EDGE_BASE_DIR=/path/to/local/work \
EDGE_HOSTING_PORT=4001 \
EDGE_CONTAINER_SERVICE=docker \
neuroflame-edge start
```

`EDGE_HTTP_URL`/`EDGE_WS_URL` here are **centralApi's** address (the same
server `neuroflame configure`'s central API URL points at) — not this
CLI's own anything. Use `https`/`wss` for a deployment behind TLS (like the
example above), `http`/`ws` for a raw local port. `EDGE_BASE_DIR` is where
run kits, mount-dir/local-params config, and results end up, so make it
somewhere with real space, not `/tmp`.

**On a machine also running the desktop app (or a second identity's own
edge client), `EDGE_HOSTING_PORT` and `EDGE_BASE_DIR` must both be unique
to this process** — never point two edge clients at the same port. Each
one tracks exactly one logged-in identity at a time (a single in-memory
access token, no per-connection isolation), so if a second client's login
lands on a port a first one already owns, it silently takes over — the
first identity gets bumped off with no error anywhere, and just never
participates in any run it should have. This is easy to hit by accident:
`3003` is `configs/electronApp1.json`'s desktop-app port, so it's *not* a
safe choice for a second, standalone client on the same box — `4001`
(this package's own shipped default, used above) deliberately isn't
anyone else's default. If something's stuck at `In Progress` with fewer
containers running than there are sites, this collision is the first
thing to check — `neuroflame edge get-run-error` and `list-results` on
the suspect site will both come back empty/404 for a participant that
never actually joined.

Once it's up, point this CLI at it — `http://localhost:4001/graphql` if
you ran it on the same machine, matching `EDGE_HOSTING_PORT` above — via
`neuroflame configure` (persists it) or `NEUROFLAME_EDGE_URL`/`--url` (a
one-off override), then `neuroflame edge connect` as usual. Confirm with
`neuroflame status` before going further — it'll catch a wrong port or an
unreachable host immediately instead of a confusing failure three commands
later.

This is a foreground process for testing; for anything longer-lived, see
[edgeFederatedClient's README](../edgeFederatedClient/README.md) for the
full environment-variable reference (`EDGE_AUTHENTICATION_ENDPOINT`,
`EDGE_LOG_PATH`), running it under systemd so it survives reboots/crashes,
and Singularity/Apptainer setup.

#### Running under SLURM

Neither `neuroflame-edge` nor `neuroflame edge start` know anything about
SLURM — they're just a process that needs Docker or Singularity
available. On a cluster, that means running them *inside* compute time
you've been allocated, not launching them from a job script that submits
other jobs.

**Interactive (`salloc`)** — get a session, then run `edge start` inside
it same as anywhere else:

```bash
salloc --nodes=1 --cpus-per-task=4 --time=02:00:00 --partition=compute
# once you're in the session:
neuroflame edge start --base-dir /scratch/$USER/neuroflame-edge --container-service singularity
```

**Unattended (`sbatch`)** — no terminal to log in on, so pair it with the
`.env` file from [Login](#login). This version is fully self-contained:
given a consortium ID and a path to this site's dataset, it logs in,
starts the edge client, points it at the right data directory, and flips
the consortium's Ready toggle — everything a human would otherwise do by
hand:

```bash
#!/bin/bash
#SBATCH --job-name=neuroflame-edge
#SBATCH --time=02:00:00
#SBATCH --cpus-per-task=4
#SBATCH --partition=compute
#SBATCH --output=neuroflame-edge-%j.log

# --- This site's participation, pre-specified ------------------------
# Edit these two, or override per-submission instead:
#   sbatch --export=ALL,CONSORTIUM_ID=...,MOUNT_DIR=... this-script.sh
: "${CONSORTIUM_ID:?Set CONSORTIUM_ID (edit above, or --export at submit time)}"
: "${MOUNT_DIR:?Set MOUNT_DIR (edit above, or --export at submit time)}"
CONTAINER_SERVICE="${CONTAINER_SERVICE:-singularity}"
EDGE_BASE_DIR="${EDGE_BASE_DIR:-/scratch/$USER/neuroflame-edge}"

# Username/password deliberately aren't parameterized the same way as
# CONSORTIUM_ID/MOUNT_DIR above — unlike those, they're secrets, and a
# SLURM job's environment/accounting record isn't necessarily private the
# way a chmod 600 file is. They live in ~/.config/neuroflame-cli/.env
# instead (see Login above) — `neuroflame login` below picks them up with
# no flags needed.

set -euo pipefail

neuroflame login
neuroflame edge start --base-dir "$EDGE_BASE_DIR" --container-service "$CONTAINER_SERVICE"
neuroflame edge set-mount-dir "$CONSORTIUM_ID" "$MOUNT_DIR"
neuroflame consortium set-ready "$CONSORTIUM_ID" true

# edge start backgrounds the actual daemon and returns immediately — with
# nothing else running, the script (and the job) would end right here.
# SLURM kills every process in a job's cgroup the moment its batch script
# exits, detached or not, so without this the daemon would die within
# seconds of starting. Hold the job open for the rest of its time limit
# instead, so the daemon actually survives long enough to pick up a run.
sleep infinity
```

```bash
sbatch --export=ALL,CONSORTIUM_ID=<id>,MOUNT_DIR=/path/to/dataset neuroflame-edge.slurm
```

[Login](#login)'s fail-fast behavior means a misconfigured job (missing
`.env`, no prior session) errors out immediately instead of silently
hanging until the time limit runs out. Point `EDGE_BASE_DIR`/`MOUNT_DIR`
at scratch storage, not the (usually small-quota, slower) home
directory — that's where run kits, results, and the dataset itself
should actually live.

**The real constraint isn't SLURM, it's *when* the container runs, not
*whether* it can.** `sbatch`/`salloc` don't guarantee the window you
asked for starts the moment you ask — you're requesting priority on
shared hardware, not commanding a machine you already own. A run expects
its participants to connect within a fairly tight window (see the
`In Progress`-forever failure mode a stalled/late site produces
elsewhere in this doc), so the practical pattern is to **pre-allocate
ahead of the actual run** — get the compute sitting there and ready
*before* a run starts, rather than submitting the job at run-start time
and hoping the queue clears fast enough. If predictable timing matters,
ask that site's HPC admin about a SLURM *reservation*
(`scontrol create reservation`, optionally recurring) — the genuinely
guaranteed-time option, though it typically needs elevated privileges to
set up.

```bash
neuroflame edge set-mount-dir <consortiumId> /path/to/local/dataset
neuroflame edge get-mount-dir <consortiumId>          # read it back
neuroflame consortium set-ready <consortiumId> true   # the GUI's Ready toggle
neuroflame edge connect                               # see below — easy to miss
```

If that machine's edge client is on a non-default port (check its
`hostingPort` — e.g. `configs/electronApp1.json` in a local dev setup uses
`3003`, not the shipped default of `4001`), run `neuroflame configure` once
so every `edge` command picks it up automatically — see [Setup and
diagnostics](#setup-and-diagnostics). `NEUROFLAME_EDGE_URL`/`--url` still
work too, for a one-off override.

**`edge connect` is easy to forget, and skipping it is a real footgun**: a
mount directory and a Ready toggle are *not* enough for a client to actually
pick up runs. The edge client only starts listening for `runStartEdge`
events after something calls its `connectAsUser` mutation — the GUI does
this automatically as part of its own login flow, but a CLI session logging
in against `centralApi` doesn't touch the edge client at all unless you
either run `edge connect` explicitly, or pass `--connect-edge` to `login`
(see [Login](#login)). Symptom if you skip it: the member shows up as
active and ready in `consortium show`, a run starts fine, but that member's
edge client never launches a container for it — from `centralApi`'s side
everything looks correct, so nothing errors, it just silently never joins.

**A related footgun the same fix doesn't cover: the mount directory itself
is per (edge client, consortium), not per identity.** It's a local file
(`<EDGE_BASE_DIR>/<consortiumId>/mount_config.json`) on whichever machine's
edge client this is — nothing syncs it from centralApi or copies it from a
different edge client. Point this identity at a *different* edge client
(a new standalone `neuroflame-edge`, a different `EDGE_BASE_DIR`, a fresh
machine) and every consortium it's a member of needs `set-mount-dir` run
again there, even ones it's run in for months elsewhere — `consortium
show`'s active/ready state is separate, server-side, and doesn't reflect
this at all. Symptom if you miss it: a run starts, looks fine everywhere
in `centralApi`, then fails with `Failed to load mount configuration`
sourced from *inside* the container. `edge connect` (and `login
--connect-edge`) now check for this automatically, with two lines of
defense:

1. **Restore what it can.** Every successful `set-mount-dir` remembers
   `(identity, consortium) → path` locally at
   `~/.config/neuroflame-cli/mount-dirs.json` — not tied to any particular
   edge client's base dir. On connect, for anything missing on the edge
   client it just wired up, it checks this history: if the same identity
   used a path for that consortium on *this machine* before, and that path
   still exists on disk, it re-applies it there automatically (and says
   so) — covering exactly the case above, a moved/re-created edge client
   for the same identity on the same box.
2. **Warn about what it can't.** Anything still missing after that (a
   consortium never configured on this machine, or a genuinely new
   machine with no history to draw on) prints as before — a plain list
   with the `set-mount-dir` command to run for each.

It still can't help with a path that's set but wrong or stale — only with
nothing being set at all — and it only ever *restores* a previously-set
path, never invents one; the very first time a consortium's data directory
is set anywhere, that's still a manual `set-mount-dir`.

If a computation also needs local-only parameters (values that shouldn't go
through central, e.g. site-specific paths), `set-local-params` writes them
next to the mount directory as `local_parameters.json`:

```bash
neuroflame edge set-local-params <consortiumId> /path/to/local/dataset '{"key":"value"}'
neuroflame edge get-local-params <consortiumId> /path/to/local/dataset
```

### Docker vs. Singularity

Which container runtime an edge client uses to actually execute runs is
also settable from here:

```bash
neuroflame edge get-container-service
neuroflame edge set-container-service singularity   # or docker
```

This didn't exist as an API at all until now — `edgeFederatedClient` only
ever read `containerService` once, from whatever config it was launched
with (`edgeClientConfig.containerService` in the desktop app's config, or
`VAULT_CONTAINER_SERVICE` for `vaultFederatedClient`). `set-container-service`
adds a `setContainerService` mutation to `edgeFederatedClient`'s own
GraphQL schema (see its `resolvers.ts`) that mutates that process's
in-memory config directly — `runStart.ts` already reads `containerService`
fresh from `getConfig()` on every run rather than caching it at startup, so
this takes effect immediately for the next run, no restart needed.

**It does not persist across that edge client process restarting**,
though — a full relaunch reverts to whatever's in the config file it was
actually started with. For a change that survives restarts, still edit
that file directly (`edgeClientConfig.containerService` in the desktop
app's config, or `VAULT_CONTAINER_SERVICE` in `vaultFederatedClient`'s
`.env`/systemd unit). Requires Singularity or Apptainer to actually be
installed on that machine either way — `which singularity apptainer`.

## Run results — and knowing they're there

A run's output files live on the local filesystem of whichever edge client
executed it — `<pathBaseDirectory>/<consortiumId>/<runId>/<participantId>/results`
— and are served over a small REST API the edge client also exposes, a
different mechanism than the mount-dir/local-params commands above (those
are GraphQL on the edge client; this is plain HTTP, matching how
`edgeFederatedClient/src/api/routes/runResultsRoutes.ts` actually serves
them, with no auth of its own):

```bash
neuroflame edge list-results <consortiumId> <runId> [participantId] [--json]
neuroflame edge download-results <consortiumId> <runId> [participantId] [--out <file>]
neuroflame edge open-results <consortiumId> <runId> [participantId]
neuroflame edge get-run-error <consortiumId> <runId> [participantId] [--json]
```

`participantId` defaults to the logged-in user's own id (their
`participantId`, for a non-vault member, is their `userId`) if omitted —
"show me my results" is the overwhelmingly common case. Pass it explicitly
to check a different participant's (e.g. a leader checking a member's
site). As soon as more than one site is involved in a run, results are
*always* scoped this way — there's no merged/flat path to fall back to,
which is why the default matters.

`list-results` is an `ls` — it tells you what's there, nothing more.
`download-results` fetches everything as one `.zip` (the same one the
desktop app's "download all" would give you). Neither of those actually
*shows* you anything, which is the real question: **`open-results` is the
one that does** — it finds `index.html` in the run's results (the report a
computation actually produces; `serveRunFile` in
`runResultsFilesController.ts` specifically rewrites its `<head>` with a
`<base>` tag to make relative asset references work when served this way,
a strong signal it's meant to be opened exactly like this) and opens it in
your default browser directly from the edge client — no download needed.
If a run's results don't include an `index.html` (not every computation
produces one), it lists what files *are* there instead of opening nothing
useful.

The problem this solves: a run finishing is easy to miss as *actionable* —
"Complete" or "Error" scrolls by in a stream of status lines like any other,
with no obvious next step. So every place a run's status is shown now
prints a one-line hint the moment it's in a terminal state — `run list`,
`run watch`, `run watch-consortium`, and `run show`:

```
6a908418df160ff1880e4f00  Complete  Single Round Ridge Regression Consortium  (updated ...)
    → results: neuroflame edge open-results 66289c79aecab67040a22001 6a908418df160ff1880e4f00
    → if that looks wrong: neuroflame edge get-run-error 66289c79aecab67040a22001 6a908418df160ff1880e4f00
```

`Error` gets the equivalent pointer at `run show <runId>` (which prints the
actual error messages directly, so `run show`'s own output skips the
redundant hint there — only `Complete` gets one from `show`). These hints
never appear in `--json` output, so `--json | jq` pipelines stay clean.

**`Complete` on `centralApi` means the container process exited cleanly —
not that the computation inside it actually succeeded.** We hit this for
real: a multi-participant run reported `Complete`, `open-results` 404'd,
and the coordinator container's own logs showed the underlying job had
actually failed (`Job status: FINISHED:EXECUTION_EXCEPTION`, from one
participant submitting a malformed result) — the edge client still reports
completion based on the process exiting 0, regardless of what happened
inside NVFlare. If results are missing for a run that says `Complete`,
check that job's actual outcome directly (`docker logs` on the coordinator
container, or the edge client's own log) rather than trusting the status
alone.

`get-run-error` is the direct, structured answer to that gotcha: when the
edge client itself notices a local computation failure, it writes a
`.neuroflame_error.json` marker next to that participant's results
(`origin`, `stage`, `scope`, `errorType`, `message` — see
`getRunError`/`runResultsFilesController.ts`), and this command reads it
back:

```bash
neuroflame edge get-run-error <consortiumId> <runId> [participantId] [--json]
```

A 404 (no marker file) just means the edge client didn't record a local
failure for that participant — not proof the computation succeeded, only
that nothing tripped this particular detector. Still check `open-results`
and the container logs directly if something looks off despite a clean
`get-run-error`.

## Guided setup: the wizard

```bash
neuroflame consortium wizard [consortiumId]                                   # resume/continue
neuroflame consortium wizard join [consortiumId]                              # explicit: join, then continue
neuroflame consortium wizard create [title] [--description <text>] [--private] # create, then continue as leader
```

An interactive, terminal equivalent of the desktop app's own consortium
setup wizard — walks you through joining (or creating) a consortium if
needed, then every setup step for your role, in the same order the GUI uses
(see `desktopApp/reactApp/src/pages/ConsortiumWizard/ConsortiumWizard.tsx`,
which this was copied from):

**Leader:** select computation (& download its image) → add a vault user
*(optional)* → set parameters → select data directory (this also runs
`edge connect`) → set local parameters *(only if the computation supports
them)* → add leader notes *(optional)* → set ready.

**Member:** view requirements (computation + leader notes, must acknowledge
to continue) → select data directory (+ `edge connect`) → set local
parameters *(if supported)* → download image → set ready.

`join`/`create` aren't a different code path from plain `wizard` past the
point of getting a `consortiumId` — they're just two more ways to arrive at
one (an explicit one for discoverability, and a genuinely new capability
for `create`, since it lets you create a consortium and walk straight into
setting it up in one command). Omit both and it lists existing consortia to
pick from. Every answer lands as the same mutation the corresponding plain
command would use, so quitting partway (Ctrl+C, or answering no to "Join
now?") is safe — nothing is undone, and rerunning the wizard just reflects
whatever state is already there and lets you continue.

Two things worth knowing if you're extending this:

- Unlike the GUI, there's no back button — going back a step in a terminal
  wizard is awkward to build well, and it's unnecessary here since every
  step is idempotent: it always reads current state first, so rerunning the
  wizard (or just rerunning the underlying plain command) is equivalent to
  "going back and changing it."
- "Download the image" runs the computation's `imageDownloadUrl` (a literal
  shell command from `centralApi`, e.g. `docker pull ...`) as a real child
  process with inherited stdio, the same thing the GUI's embedded terminal
  does. `src/utils/prompt.ts`'s prompt reuses one `readline` interface for
  the whole wizard (see its file comment for why — reused interfaces avoid
  a data-loss bug the original per-question-interface design had) and
  explicitly pauses/resumes it around that child so the two don't fight
  over stdin.

## Environment variables

```bash
NEUROFLAME_HTTP_URL          # central API GraphQL HTTP endpoint — overrides `configure`/session
NEUROFLAME_WS_URL            # central API GraphQL WS endpoint — overrides `configure`/session
NEUROFLAME_EDGE_URL          # local edge client GraphQL endpoint, for `edge` commands
                              # — overrides `configure`; unset, falls back to the persisted
                              # value from `neuroflame configure`, then http://localhost:4001/graphql
NEUROFLAME_EDGE_WS_URL       # edge client subscription endpoint — overrides `configure`;
                              # unset, derived from the resolved edge URL (http→ws)
NEUROFLAME_EDGE_RESULTS_URL  # edge client run-results endpoint — overrides `configure`;
                              # unset, derived from the resolved edge URL (strips /graphql,
                              # appends /run-results)
NEUROFLAME_USERNAME          # non-interactive login
NEUROFLAME_PASSWORD          # non-interactive login
NEUROFLAME_DEBUG             # "true" for verbose diagnostics on stderr
```

The last two exist for parity with the desktop app's own config
(`desktopApp/electronApp/src/types.ts`'s `Config` type has
`edgeClientSubscriptionUrl` and `edgeClientRunResultsUrl` as independent
fields, not derived) — in every real setup we've seen they share the edge
URL's origin, so deriving is the sensible default, but a deployment that
doesn't colocate them can override either independently without touching
the other. `neuroflame status` always shows what they actually resolved to
and where that came from.

Prefer `neuroflame configure` over exporting these for anything you'll run
more than once — env vars are for one-off overrides (scripts, CI, "just
this one command against a different server"), `configure` is for "this is
where things actually live, remember it."

## Design notes

- No Apollo Client — a thin `fetch()`-based GraphQL client for
  queries/mutations plus `graphql-ws` for subscriptions, the same pattern
  `edgeFederatedClient`/`vaultFederatedClient` already use to talk to
  `centralApi`. Auth is a bearer token on `x-access-token` (HTTP) /
  `accessToken` in `connectionParams` (WS) — no new server-side auth path.
- stdout is reserved for command output (so `--json | jq` stays clean);
  diagnostics go to stderr via `src/logger.ts`.
- No argv-parsing dependency — manual parsing in `src/utils/flags.ts`,
  matching `vaultFederatedClient/src/cli.ts`'s style.
- All GraphQL documents and their TS payload types live in one place,
  `src/graphql/operations.ts`, grouped by resource and mirroring
  `centralApi/src/graphql/typeDefs.graphql` field-for-field — that's the
  first place to check (and update) if the two drift.
- Each resource has one dispatcher file under `src/commands/` (e.g.
  `consortium.ts`) exporting a `*Command(subcommand, args)` function that
  `src/cli.ts` routes to. Adding a new subcommand to an existing resource is
  a new case in that file's `switch`; a genuinely new resource is a new
  dispatcher file wired into `src/cli.ts`'s `switch` and `HELP` text.
- Usage errors are raised as `throw new Error('Usage: ...')` (see
  `src/commands/shared.ts#usageError`) and caught centrally in `cli.ts`,
  which prints them without an `Error:` prefix and sets exit code 1.
- `edge` is the one resource that doesn't talk to `session.httpUrl`
  (`centralApi`) — it talks to `resolveEdgeUrl()` (`src/config.ts`), the
  local edge client. The session's access token still works there unchanged;
  the edge client validates it by asking `centralApi`, not by checking a
  local secret, so there's nothing extra to authenticate.
- `src/cliConfig.ts` (`~/.config/neuroflame-cli/config.json`) is a second,
  distinct persistence file from `src/session.ts` (`session.json`) — session
  is about *who's logged in*, and only exists once a login has succeeded;
  cliConfig is about *which servers to talk to*, settable before any login
  exists. `resolveServerUrls`/`resolveEdgeUrl`/`resolveEdgeWsUrl`/
  `resolveEdgeRunResultsUrl` (`src/config.ts`) all read it as a fallback
  between env vars and hardcoded (or derived) defaults, which is why all
  are `async` (a file read) — `neuroflame configure` is the only thing that
  writes it. The last two intentionally take an already-resolved edge HTTP
  URL as a parameter rather than re-resolving independently, so a one-off
  `--url` override on the base edge command correctly carries through to
  what they derive by default.
- `edge connect` (and `login --connect-edge`) both call the same exported
  `connectEdgeClient()` (`src/commands/edge.ts`) rather than duplicating the
  mutation call — `login` treats a failure as a warning, not fatal, since
  logging in itself already succeeded.

## Local development

```bash
npm install
npm run compile
node ./dist/cli.js --help
```

### Testing against a local dev server

From the repo root, bring up `centralApi` and its database:

```bash
npm run db:start                          # starts MongoDB via Docker Compose
cd centralApi
cp .env.template .env                     # if you don't already have one
node dev-start.js npm run seed            # wipes and reseeds dev data
node dev-start.js                         # loads .env, then `npm start`
```

`centralApi` listens on `http://localhost:3001/graphql`. The seed data
(`centralApi/src/database/seed.ts`) gives you real test accounts and a
consortium to exercise every command against:

| Username | Password | Role |
|---|---|---|
| `user1@email.com` | `password1` | leader of the seeded consortium |
| `user2@email.com` | `password2` | member |
| `user4@email.com` | `password4` | admin |
| `cobrefs@email.com` | `vaultPassword1` | vault |

Seeded consortium id: `66289c79aecab67040a22001`.

Then, in another terminal:

```bash
cd cliAppClient
npm run compile
export NEUROFLAME_HTTP_URL=http://localhost:3001/graphql
export NEUROFLAME_WS_URL=ws://localhost:3001/graphql

node dist/cli.js login --username user1@email.com --password password1
node dist/cli.js whoami
node dist/cli.js consortium list
node dist/cli.js consortium show 66289c79aecab67040a22001
node dist/cli.js study set-notes 66289c79aecab67040a22001 "hello from the CLI"
node dist/cli.js run start 66289c79aecab67040a22001
node dist/cli.js run list --json
```

`npm run seed` wipes and reseeds every time, so it's safe to rerun if your
local dev data gets into a state you don't want (e.g. a stuck `Provisioning`
run — completed/errored runs can be deleted with `run delete`, but an
in-progress one can't).

To also exercise the `edge` commands against a real edge client instead of
just reading its code, run the desktop app locally (`desktopApp/electronApp`
+ `desktopApp/reactApp`, see `docs/developer-guide.md`) and point
`NEUROFLAME_EDGE_URL` at its embedded edge client's port (`3003` in
`configs/electronApp1.json`).

#### Getting a run to actually complete (two participants)

The seeded consortium has two members. A run needs *both* connected before
the underlying FL job will schedule at all — with only one, `centralApi`
happily reports the run as `In Progress` forever (it isn't lying: one site
genuinely is connected and waiting) while the job scheduler logs `connected
sites (1) < min_sites (2)` and never starts. To see one actually reach
`Complete`, bring up a second, fully independent desktop app instance as
`user2` — there's already a second dev config for this
(`configs/electronApp2.json`, `hostingPort` 3004, a separate
`pathBaseDirectory`):

```bash
cd desktopApp/electronApp
env -u ELECTRON_RUN_AS_NODE npm run start-configured-2 -- \
  --user-data-dir=/tmp/neuroflame-user2-profile
```

The `--user-data-dir` matters: without it, a second instance shares the
first's Electron profile (cookies/localStorage), which can leave it
logged in as the wrong user or fighting over the same profile lock. Then,
against that instance's edge client:

```bash
NEUROFLAME_EDGE_URL=http://localhost:3004/graphql \
  neuroflame login --username user2@email.com --password password2 --connect-edge
NEUROFLAME_EDGE_URL=http://localhost:3004/graphql \
  neuroflame edge set-mount-dir 66289c79aecab67040a22001 /path/to/local/dataset
neuroflame consortium set-ready 66289c79aecab67040a22001 true
```

(Logging in via the CLI swaps the *CLI's* session identity too — log back
in as `user1` afterward if you want the CLI itself to keep acting as them.)

Note the subscription ordering: `edge connect`/`--connect-edge` only
affects runs started *after* it — a client that connects mid-run misses
that run's original `runStartEdge` event and won't join it. Start (or
restart) the run after both clients are connected:

```bash
neuroflame run start 66289c79aecab67040a22001 --wait
```
