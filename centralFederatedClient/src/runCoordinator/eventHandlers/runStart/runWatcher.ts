import fs from 'fs'
import os from 'os'
import path, { resolve, dirname } from 'path'
import {
  spawn,
  spawnSync,
  type SpawnOptions,
  type ChildProcess,
} from 'child_process'
import { fileURLToPath } from 'url'

export type WatcherTag = 'RUN' | 'DRAIN'

export interface RunWatcherOptions {
  root: string
  consortiumId: string
  runId: string
  startupOverride?: string
  tag?: WatcherTag
  pollSec?: number
  drainWindowSec?: number
  unreachExit?: number
  pretty?: boolean
  showClients?: boolean
  resilient?: boolean
  extraArgs?: string[]
  env?: NodeJS.ProcessEnv
  logger?: { info: (...a: any[]) => void; warn: (...a: any[]) => void }
}

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

function findSystemPython(): string {
  const fromEnv = process.env.ADMIN_PY
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv

  const names = process.platform === 'win32'
    ? ['python.exe', 'python3.exe']
    : ['python3', 'python']
  const paths = (process.env.PATH || '').split(path.delimiter)
  for (const p of paths) {
    for (const n of names) {
      const exe = path.join(p, n)
      try { fs.accessSync(exe, fs.constants.X_OK); return exe } catch {}
    }
  }
  return process.platform === 'win32' ? 'python' : 'python3'
}

function findWatcherScript(importMetaUrl: string): string {
  const __filename = fileURLToPath(importMetaUrl)
  const __dirname = dirname(__filename)

  const distCandidate = resolve(__dirname, 'nvflare_report.py')
  if (fs.existsSync(distCandidate)) return distCandidate

  const srcCandidate = distCandidate.replace(
    `${path.sep}dist${path.sep}`,
    `${path.sep}src${path.sep}`
  )
  if (fs.existsSync(srcCandidate)) return srcCandidate

  throw new Error(
    `nvflare_report.py not found.\nTried:\n  ${distCandidate}\n  ${srcCandidate}\n` +
    `Ensure the script is copied to dist/ or present in src/.`
  )
}

function readNvflareVersion(pythonExe: string): { ok: boolean; version?: string } {
  const probe = spawnSync(
    pythonExe,
    ['-c', 'import sys; import json; \n'
      + 'try:\n'
      + '  import nvflare as _n\n'
      + '  v = getattr(_n, "__version__", None)\n'
      + '  print(json.dumps({"ok": True, "version": v}))\n'
      + 'except Exception as e:\n'
      + '  print(json.dumps({"ok": False}))\n'
    ],
    { encoding: 'utf8' }
  )
  if (probe.status !== 0) return { ok: false }
  try {
    const data = JSON.parse(probe.stdout.trim())
    return { ok: !!data.ok, version: data.version ?? undefined }
  } catch {
    return { ok: false }
  }
}

function ensurePip(pythonExe: string, log: { info: Function; warn: Function }) {
  const up = spawnSync(pythonExe, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'], { encoding: 'utf8' })
  if (up.status !== 0) {
    log.warn(`[watcher] pip bootstrap/upgrade warning: ${up.stderr || up.stdout}`)
  }
}

function installNvflare(pythonExe: string, version: string, log: { info: Function; warn: Function }): boolean {
  log.info(`[watcher] Installing nvflare==${version}`)
  ensurePip(pythonExe, log)
  const inst = spawnSync(pythonExe, ['-m', 'pip', 'install', `nvflare==${version}`], { encoding: 'utf8' })
  if (inst.status !== 0) {
    log.warn(`[watcher] nvflare install failed: ${inst.stderr || inst.stdout}`)
    return false
  }
  return true
}

/**
 * Ensure a project-local venv at ./.nf-admin311-venv with the required nvflare version.
 * - If ADMIN_PY is set and has matching version, use it.
 * - Else create/use .nf-admin311-venv and pin nvflare to REQUIRED_NVFLARE.
 */
function ensureAdminPythonWithNvflare(
  projectRoot: string,
  log: { info: Function; warn: Function }
): string {
  const REQUIRED_NVFLARE = process.env.NVFLARE_VERSION || '2.6.2'

  // 1) Respect ADMIN_PY if present AND version matches exactly.
  const envPy = process.env.ADMIN_PY
  if (envPy && fs.existsSync(envPy)) {
    const v = readNvflareVersion(envPy)
    if (v.ok && v.version === REQUIRED_NVFLARE) {
      log.info(`[watcher] Using ADMIN_PY: ${envPy} (nvflare ${v.version})`)
      return envPy
    }
    if (v.ok) {
      log.warn(`[watcher] ADMIN_PY nvflare version mismatch: ${v.version} (need ${REQUIRED_NVFLARE}); will bootstrap local venv.`)
    } else {
      log.warn(`[watcher] ADMIN_PY set but nvflare not importable; will bootstrap local venv.`)
    }
  }

  // 2) Prepare local venv
  const venvDir = path.join(projectRoot, '.nf-admin311-venv')
  const pythonInVenv = process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python')

  if (!fs.existsSync(pythonInVenv)) {
    const sysPy = findSystemPython()
    log.info(`[watcher] Creating venv at ${venvDir} using ${sysPy}`)
    const mk = spawnSync(sysPy, ['-m', 'venv', venvDir], { encoding: 'utf8' })
    if (mk.status !== 0) {
      log.warn(`[watcher] venv creation failed, falling back to system python: ${mk.stderr || mk.stdout}`)
      // Try system python as a last resort (will still try to install the right version)
      const v = readNvflareVersion(sysPy)
      if (!v.ok || v.version !== REQUIRED_NVFLARE) {
        if (!installNvflare(sysPy, REQUIRED_NVFLARE, log)) {
          // We still return sysPy; the spawn may fail later but we tried.
          log.warn(`[watcher] Proceeding with system python (${sysPy}) despite nvflare mismatch.`)
        }
      }
      return sysPy
    }
  }

  // 3) Ensure venv has the correct nvflare version
  const have = readNvflareVersion(pythonInVenv)
  if (!have.ok || have.version !== REQUIRED_NVFLARE) {
    if (!installNvflare(pythonInVenv, REQUIRED_NVFLARE, log)) {
      // If venv install fails, try system python as last resort with pin.
      const sysPy = findSystemPython()
      const v = readNvflareVersion(sysPy)
      if (!v.ok || v.version !== REQUIRED_NVFLARE) {
        if (!installNvflare(sysPy, REQUIRED_NVFLARE, log)) {
          log.warn(`[watcher] Could not provision nvflare==${REQUIRED_NVFLARE} in venv nor system python. Using venv python anyway.`)
        } else {
          log.info(`[watcher] Using system python with nvflare==${REQUIRED_NVFLARE}: ${sysPy}`)
          return sysPy
        }
      } else {
        log.info(`[watcher] Using system python (already has nvflare ${v.version}): ${sysPy}`)
        return sysPy
      }
    }
  }

  const finalV = readNvflareVersion(pythonInVenv)
  log.info(`[watcher] Using ADMIN_PY: ${pythonInVenv} (nvflare ${finalV.version ?? 'unknown'})`)
  return pythonInVenv
}

export function defaultCentralRootFromEnvOrGuess(): string {
  return (
    process.env.CENTRAL_FED_CLIENT_DIR ||
    path.join(
      os.homedir(),
      'Projects',
      'NeuroFLAME',
      '_devTestDirectories',
      'centralFederatedClientDir'
    )
  )
}

export function spawnNvflareWatcher(
  opts: RunWatcherOptions,
  importMetaUrl = import.meta.url
): ChildProcess {
  const log = opts.logger ?? console
  const watcherScript = findWatcherScript(importMetaUrl)

  const projectRoot =
    process.env.NF_PROJECT_ROOT ||
    path.resolve(dirname(fileURLToPath(importMetaUrl)), '..', '..', '..', '..')

  const python = ensureAdminPythonWithNvflare(projectRoot, log)

  const {
    root,
    consortiumId,
    runId,
    startupOverride,
    tag = 'RUN',
    pollSec = 2,
    drainWindowSec = 180,
    unreachExit = 0,
    pretty = true,
    showClients = true,
    resilient = true,
    extraArgs = [],
  } = opts

  const startupDir =
    startupOverride ||
    path.join(root, 'runs', consortiumId, runId, 'runKits', 'centralNode', 'admin', 'startup')

  // Build base args (no --timeout)
  const args = [
    '-u',
    watcherScript,
    '--poll', String(pollSec),
    '--drain-window', String(drainWindowSec),
    '--unreach-exit', String(Math.max(0, unreachExit)),
    showClients ? '--show-clients' : '',
    pretty ? '--pretty' : '',
    resilient ? '--resilient' : '',
    ...extraArgs,
  ].filter(Boolean)

  // Startup selection strategy:
  // - Default: EXACT startup (explicit --startup path).
  // - If NF_WATCHER_MONITOR_LATEST=1 or extraArgs contains --monitor-latest -> use monitor-latest instead.
  const forceExactStartup =
    process.env.NF_WATCHER_EXACT_STARTUP === '1' ||
    extraArgs.includes('--exact-startup')

  const wantMonitorLatest =
    (!forceExactStartup) &&
    (process.env.NF_WATCHER_MONITOR_LATEST === '1' || extraArgs.includes('--monitor-latest'))

  if (wantMonitorLatest) {
    if (!args.includes('--monitor-latest')) args.push('--monitor-latest')
  } else {
    if (startupDir) {
      args.push('--startup', startupDir)
    }
  }

  // Show final args once
  log.info('[watcher:ARGS]', args.join(' '))

  const spawnOpts: SpawnOptions = {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(opts.env ?? {}) },
    cwd: path.dirname(watcherScript),
  }

  log.info(`[watcher:${tag}] ${python} ${args.join(' ')}`)
  const child = spawn(python, args, spawnOpts)

  if (child.stdout) {
    child.stdout.on('data', (buf: Buffer) => {
      const line = buf.toString('utf8').trimEnd()
      if (line) log.info(`[watcher:${tag}] ${line}`)
    })
  } else {
    log.warn(`[watcher:${tag}] stdout not available`)
  }

  if (child.stderr) {
    child.stderr.on('data', (buf: Buffer) => {
      const line = buf.toString('utf8').trimEnd()
      if (line) log.warn(`[watcher:${tag}:stderr] ${line}`)
    })
  } else {
    log.warn(`[watcher:${tag}] stderr not available`)
  }

  child.on('exit', (code, signal) => {
    log.info(`[watcher:${tag}] exited code=${code} signal=${signal}`)
  })

  return child
}

export async function scheduleNvflareWatcher(
  opts: RunWatcherOptions & { startDelaySec?: number },
  importMetaUrl = import.meta.url
): Promise<ChildProcess> {
  const delayMs = Math.max(0, Math.floor((opts.startDelaySec ?? 10) * 1000))
  if (delayMs) (opts.logger ?? console).info(`[watcher:${opts.tag ?? 'RUN'}] delaying start by ${Math.round(delayMs / 1000)}s`)
  if (delayMs) await sleep(delayMs)
  return spawnNvflareWatcher(opts, importMetaUrl)
}
