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
// This is deliberately NOT the same as merging cliAppClient and
// edgeFederatedClient into one package (see the README/conversation on
// why that trades away more than it buys for the common pure-control-plane
// CLI user). It still shells out to the separately-installed
// `neuroflame-edge` binary as its own process — the CLI stays
// dependency-light; it just also knows how to launch, track, and stop
// that process instead of requiring a human to do it by hand in a second
// terminal. It only helps the case where the CLI and the edge daemon
// belong on the same machine — the common single-workstation case — not
// the genuinely distributed HPC case where they're deliberately apart.

import { spawn } from 'child_process'
import { openSync, closeSync, promises as fs, existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { loadCliConfig, saveCliConfig } from './cliConfig.js'
import { resolveServerUrls, ServerUrls } from './config.js'

// Resolving `neuroflame-edge` — deliberately NOT a bare `spawn('neuroflame-
// edge', ...)` PATH lookup. Caught live: a user ran `npm install -g
// edge-federated-client` successfully, then `nf edge start` still failed
// with ENOENT — npm's global bin directory for their active Node install
// simply wasn't on that shell's PATH (a very common footgun, especially
// with nvm/multiple Node installs, and made worse by the fact the install
// itself gives no sign anything's wrong). Rather than depend on PATH being
// set up right, ask the exact npm that's running *this* process — always a
// sibling of `node` in the same bin directory, for every mainstream Node
// distribution (nvm, Homebrew, the official installer, ...) — where its
// global packages actually live, then spawn the resolved script directly
// with `process.execPath`.
async function npmGlobalRoot(): Promise<string> {
  const nodeDir = path.dirname(process.execPath)
  const siblingNpm = path.join(nodeDir, 'npm')
  const npmCommand = existsSync(siblingNpm) ? siblingNpm : 'npm'
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ['root', '-g'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      // npm's own script is itself a `#!/usr/bin/env node` shebang — even
      // spawning it by absolute path still needs `node` resolvable via
      // PATH for that shebang line to run at all. Prepend node's own
      // directory (found above independent of PATH) so this can't fail
      // the exact same way for the same reason one level down, regardless
      // of whatever PATH this process itself inherited.
      env: { ...process.env, PATH: `${nodeDir}${path.delimiter}${process.env.PATH ?? ''}` },
    })
    let stdout = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`"${npmCommand} root -g" exited with code ${code}`))
    })
  })
}

async function resolveEdgeBinary(): Promise<string> {
  const globalRoot = await npmGlobalRoot()
  const pkgDir = path.join(globalRoot, 'edge-federated-client')
  let pkgJson: { bin?: string | Record<string, string> }
  try {
    pkgJson = JSON.parse(await fs.readFile(path.join(pkgDir, 'package.json'), 'utf8'))
  } catch {
    throw new Error(
      "edge-federated-client isn't installed where npm's global packages live " +
        `(${globalRoot}). Install it: npm install -g edge-federated-client`,
    )
  }
  const binEntry =
    typeof pkgJson.bin === 'string' ? pkgJson.bin : pkgJson.bin?.['neuroflame-edge']
  if (!binEntry) {
    throw new Error(
      `${pkgDir}/package.json has no "neuroflame-edge" bin entry — this doesn't ` +
        'look like a compatible edge-federated-client install.',
    )
  }
  return path.join(pkgDir, binEntry)
}

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
  const edgeBinary = await resolveEdgeBinary()

  await fs.mkdir(STATE_DIR, { recursive: true, mode: 0o700 })
  await fs.mkdir(baseDir, { recursive: true })
  const logFd = openSync(LOG_PATH, 'a')

  const child = spawn(process.execPath, [edgeBinary, 'start'], {
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

  // Give a launch failure (e.g. the binary not being installed at all) a
  // moment to surface as an 'error' event before we detach and move on —
  // without this, a missing `neuroflame-edge` would fail silently in the
  // background instead of being reported here.
  await new Promise((resolve) => setTimeout(resolve, 300))
  if (spawnError) {
    closeSync(logFd)
    throw new Error(`Could not launch ${edgeBinary} (${spawnError.message}).`)
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
