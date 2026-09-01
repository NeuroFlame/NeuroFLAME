// Manages a local edge-federated-client process on the CLI's behalf.
//
// Until now, using `edge` commands meant a human had to separately install
// and launch `neuroflame-edge start` in its own terminal/session (or run
// the desktop app), track whether it was still alive, and remember to
// `edge connect` again if it ever restarted — a real, repeated source of
// friction this session (an edge daemon silently not running, or having
// restarted with a lost subscription, showed up as "only one container
// spawned" more than once). `neuroflame edge start` collapses that into
// one command: spawn the daemon if nothing's there, track it via a PID
// file, reconnect to it if it's already running, then connect and run the
// mount-dir preflight — one identity, one command, one site, running.
//
// edge-federated-client is now a real dependency of this package (bundled,
// not a separately-installed sibling binary) — this was deliberately the
// other way around earlier (see git history), on the theory that a
// pure-control-plane CLI user shouldn't pay for Docker/Apollo/Express-
// weight dependencies they'd never touch. That held up until it collided
// with reality twice in a row: the separately-published edge-federated-
// client fell out of sync with this CLI's own expectations of it (a
// published version missing the very binary it was supposed to provide),
// and PATH-dependent resolution of an external binary is exactly the kind
// of fragile-on-a-fresh-machine problem bundling avoids entirely. The
// actual primary use case here is a headless edge client, not pure
// control-plane usage — so the tradeoff flipped. Still spawned as a
// separate OS process (not literally in the CLI's own process) so it can
// outlive the `edge start` invocation and be tracked/stopped by PID like
// before — just spawns *this same* cli.js, with an internal subcommand
// (`__edge-daemon`, see cli.ts) instead of a different package's binary.
// It only helps the case where the CLI and the edge daemon belong on the
// same machine — the common single-workstation case — not the genuinely
// distributed HPC case where they're deliberately apart; install
// `@neuroflame/cli` there too and run `edge start` the same way, or use
// edge-federated-client's own standalone `neuroflame-edge` directly if you
// want a minimal footprint with no CLI control-plane commands at all.

import { spawn } from 'child_process'
import { openSync, closeSync, promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { loadCliConfig, saveCliConfig } from './cliConfig.js'
import { resolveServerUrls, ServerUrls } from './config.js'

// dist/edgeDaemon.js and dist/cli.js always live side by side (same build
// output directory) — no PATH, no npm, no external resolution needed.
const OWN_CLI_ENTRY = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli.js')

const STATE_DIR = path.join(os.homedir(), '.config', 'neuroflame-cli')
const PID_PATH = path.join(STATE_DIR, 'edge-daemon.pid')
const LOG_PATH = path.join(STATE_DIR, 'edge-daemon.log')

export const DEFAULT_DAEMON_PORT = 4001
export const DEFAULT_DAEMON_BASE_DIR = path.join(STATE_DIR, 'edge-data')

export interface EdgeDaemonOptions {
  baseDir?: string
  hostingPort?: number
  containerService?: 'docker' | 'singularity'
}

export interface DaemonStatus {
  running: boolean
  pid?: number
}

export interface StartDaemonResult {
  alreadyRunning: boolean
  pid: number
  edgeUrl: string
  baseDir: string
  hostingPort: number
  containerService: string
}

async function readPid(): Promise<number | null> {
  try {
    const raw = await fs.readFile(PID_PATH, 'utf8')
    const pid = Number(raw.trim())
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

/** `process.kill(pid, 0)` sends no signal — it just checks the PID exists. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function isEdgeReachable(edgeUrl: string): Promise<boolean> {
  try {
    await fetch(edgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    })
    return true
  } catch {
    return false
  }
}

export async function getDaemonStatus(): Promise<DaemonStatus> {
  const pid = await readPid()
  if (pid !== null && isAlive(pid)) {
    return { running: true, pid }
  }
  return { running: false }
}

/**
 * Starts the daemon if nothing's running (or reconnects to it if this
 * CLI's own PID file points at a live, reachable one already). Options
 * fall back to whatever was used last time (persisted in cliConfig's
 * edgeDaemon field), then to sane defaults — so a bare `edge start` on a
 * second occasion just works without re-specifying anything.
 */
export async function startDaemon(
  session: ServerUrls | null,
  opts: EdgeDaemonOptions,
): Promise<StartDaemonResult> {
  const cliConfig = await loadCliConfig()
  const remembered = cliConfig.edgeDaemon ?? {}

  const hostingPort = opts.hostingPort ?? remembered.hostingPort ?? DEFAULT_DAEMON_PORT
  const baseDir = opts.baseDir ?? remembered.baseDir ?? DEFAULT_DAEMON_BASE_DIR
  const containerService = opts.containerService ?? remembered.containerService ?? 'docker'
  const edgeUrl = `http://localhost:${hostingPort}/graphql`

  const status = await getDaemonStatus()
  if (status.running && (await isEdgeReachable(edgeUrl))) {
    return {
      alreadyRunning: true,
      pid: status.pid as number,
      edgeUrl,
      baseDir,
      hostingPort,
      containerService,
    }
  }

  const { httpUrl, wsUrl } = await resolveServerUrls(session)

  await fs.mkdir(STATE_DIR, { recursive: true, mode: 0o700 })
  await fs.mkdir(baseDir, { recursive: true })
  const logFd = openSync(LOG_PATH, 'a')

  const child = spawn(process.execPath, [OWN_CLI_ENTRY, '__edge-daemon'], {
    env: {
      ...process.env,
      EDGE_HTTP_URL: httpUrl,
      EDGE_WS_URL: wsUrl,
      EDGE_BASE_DIR: baseDir,
      EDGE_HOSTING_PORT: String(hostingPort),
      EDGE_CONTAINER_SERVICE: containerService,
    },
    detached: true,
    stdio: ['ignore', logFd, logFd],
  })

  let spawnError: Error | undefined
  child.once('error', (error) => {
    spawnError = error
  })

  // Give a launch failure a moment to surface as an 'error' event before we
  // detach and move on — without this, a spawn failure would fail silently
  // in the background instead of being reported here.
  await new Promise((resolve) => setTimeout(resolve, 300))
  if (spawnError) {
    closeSync(logFd)
    throw new Error(`Could not launch ${OWN_CLI_ENTRY} (${spawnError.message}).`)
  }

  const pid = child.pid as number
  child.unref()
  closeSync(logFd)

  await fs.writeFile(PID_PATH, String(pid))
  await saveCliConfig({ ...cliConfig, edgeDaemon: { baseDir, hostingPort, containerService } })

  // Poll rather than assume it's instantly up — every edge client started
  // this session took anywhere from a few hundred ms to a couple seconds
  // before its GraphQL endpoint actually answered.
  const deadline = Date.now() + 15000
  let reachable = false
  while (Date.now() < deadline) {
    if (await isEdgeReachable(edgeUrl)) {
      reachable = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!reachable) {
    throw new Error(
      `Started neuroflame-edge (pid ${pid}) but it never became reachable ` +
        `at ${edgeUrl} within 15s — check ${LOG_PATH} for what went wrong.`,
    )
  }

  return { alreadyRunning: false, pid, edgeUrl, baseDir, hostingPort, containerService }
}

export async function stopDaemon(): Promise<{ stopped: boolean; pid?: number }> {
  const pid = await readPid()
  const alive = pid !== null && isAlive(pid)
  if (alive) {
    process.kill(pid as number, 'SIGTERM')
  }
  await fs.rm(PID_PATH, { force: true })
  return alive ? { stopped: true, pid: pid as number } : { stopped: false }
}

export { PID_PATH, LOG_PATH, STATE_DIR }
