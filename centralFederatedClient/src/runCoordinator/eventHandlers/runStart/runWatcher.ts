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
import reportRunMeta from '../../report/reportRunMeta.js'
import { logger as defaultLogger } from '../../../logger.js'

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

  // Optional: force internal admin host/port flags to nvflare_report.py
  forceInternalAdmin?: boolean
  forceAdminHost?: string
  forceAdminPort?: number
}

/* ---------------- helpers: Python discovery ---------------- */

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

function readPythonVersion(pythonExe: string): { ok: boolean; major?: number; minor?: number } {
  const out = spawnSync(
    pythonExe,
    ['-c', 'import sys, json; print(json.dumps({"major":sys.version_info[0], "minor":sys.version_info[1]}))'],
    { encoding: 'utf8' }
  )
  if (out.status !== 0) return { ok: false }
  try {
    const v = JSON.parse((out.stdout || '').trim())
    return { ok: true, major: v.major, minor: v.minor }
  } catch {
    return { ok: false }
  }
}

function findPython311(): { found: boolean; exe?: string; via?: 'direct'|'py-launcher' } {
  // 1) Direct known paths & PATH lookups
  const candidates: string[] = []
  if (process.platform === 'darwin') {
    candidates.push('/opt/homebrew/bin/python3.11', '/usr/local/bin/python3.11')
  }
  if (process.platform !== 'win32') {
    candidates.push('/usr/bin/python3.11', '/usr/local/bin/python3.11', 'python3.11')
  } else {
    candidates.push('python3.11.exe', 'python3.11') // PATH probe
  }

  for (const exe of candidates) {
    const probed = spawnSync(exe, ['-V'], { encoding: 'utf8' })
    if (probed.status === 0 && /Python 3\.11\./.test(probed.stdout || probed.stderr || '')) {
      return { found: true, exe, via: 'direct' }
    }
  }

  // 2) Windows: py launcher
  if (process.platform === 'win32') {
    const probe = spawnSync('py', ['-3.11', '-V'], { encoding: 'utf8' })
    if (probe.status === 0 && /Python 3\.11\./.test(probe.stdout || probe.stderr || '')) {
      // we’ll invoke with: py -3.11 -m venv <dir>
      return { found: true, exe: 'py', via: 'py-launcher' }
    }
  }

  return { found: false }
}

/* ---------------- helpers: script & nvflare ---------------- */

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
    ['-c', 'import sys, json; ' +
      'ok=False; v=None\n' +
      'try:\n' +
      '  import nvflare as _n\n' +
      '  ok=True; v=getattr(_n,"__version__",None)\n' +
      'except Exception:\n' +
      '  pass\n' +
      'print(json.dumps({"ok": ok, "version": v}))'
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
 * Ensure a project-local venv at ./.nf-admin311-venv using **Python 3.11** when possible.
 * Behavior:
 *  - If ADMIN_PY is set and has matching nvflare version, use it.
 *  - Else, create/use .nf-admin311-venv:
 *      * Prefer creating the venv with python3.11 (mac/linux direct; windows via `py -3.11`)
 *      * If venv exists but is not 3.11 and NF_ENFORCE_PY311 !== '0', recreate it with 3.11
 *  - Pin/verify nvflare==REQUIRED_NVFLARE
 */
function ensureAdminPythonWithNvflare(
  projectRoot: string,
  log: { info: Function; warn: Function }
): string {
  const REQUIRED_NVFLARE = process.env.NVFLARE_VERSION || '2.6.2'
  const ENFORCE_PY311 = process.env.NF_ENFORCE_PY311 !== '0' // default: enforce

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

  // 2) Prepare local venv target
  const venvDir = path.join(projectRoot, '.nf-admin311-venv')
  const py311 = findPython311()

  const pythonInVenv = process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python')

  const createVenvWith = (py11: typeof py311): boolean => {
    if (!py11.found) return false
    if (py11.via === 'py-launcher') {
      const mk = spawnSync('py', ['-3.11', '-m', 'venv', venvDir], { encoding: 'utf8' })
      if (mk.status !== 0) {
        log.warn(`[watcher] venv creation with "py -3.11 -m venv" failed: ${mk.stderr || mk.stdout}`)
        return false
      }
      return true
    } else {
      const mk = spawnSync(py11.exe!, ['-m', 'venv', venvDir], { encoding: 'utf8' })
      if (mk.status !== 0) {
        log.warn(`[watcher] venv creation with python3.11 failed: ${mk.stderr || mk.stdout}`)
        return false
      }
      return true
    }
  }

  // Create or re-create venv if needed
  if (!fs.existsSync(pythonInVenv)) {
    if (py311.found) {
      log.info(`[watcher] Creating venv at ${venvDir} with Python 3.11 (${py311.via === 'py-launcher' ? 'py -3.11' : py311.exe})`)
      if (!createVenvWith(py311)) {
        log.warn('[watcher] Could not create venv with Python 3.11; falling back to system python')
        const sysPy = findSystemPython()
        const mk = spawnSync(sysPy, ['-m', 'venv', venvDir], { encoding: 'utf8' })
        if (mk.status !== 0) {
          log.warn(`[watcher] venv creation with system python failed: ${mk.stderr || mk.stdout}`)
          // Fall back to system python (no venv)
          const v = readNvflareVersion(sysPy)
          if (!v.ok || v.version !== REQUIRED_NVFLARE) {
            if (!installNvflare(sysPy, REQUIRED_NVFLARE, log)) {
              log.warn(`[watcher] Proceeding with system python (${sysPy}) despite nvflare mismatch.`)
            }
          }
          return sysPy
        }
      }
    } else {
      log.warn('[watcher] Python 3.11 not found on system PATH. Consider installing python@3.11. Using system python for venv.')
      const sysPy = findSystemPython()
      const mk = spawnSync(sysPy, ['-m', 'venv', venvDir], { encoding: 'utf8' })
      if (mk.status !== 0) {
        log.warn(`[watcher] venv creation with system python failed: ${mk.stderr || mk.stdout}`)
        // Fall back to system python (no venv)
        const v = readNvflareVersion(sysPy)
        if (!v.ok || v.version !== REQUIRED_NVFLARE) {
          if (!installNvflare(sysPy, REQUIRED_NVFLARE, log)) {
            log.warn(`[watcher] Proceeding with system python (${sysPy}) despite nvflare mismatch.`)
          }
        }
        return sysPy
      }
    }
  } else if (ENFORCE_PY311) {
    const v = readPythonVersion(pythonInVenv)
    if (!(v.ok && v.major === 3 && v.minor === 11)) {
      log.warn(`[watcher] Existing venv is Python ${v.ok ? `${v.major}.${v.minor}` : 'unknown'}; enforcing 3.11 by recreating venv.`)
      try { fs.rmSync(venvDir, { recursive: true, force: true }) } catch {}
      if (py311.found) {
        log.info(`[watcher] Recreating venv at ${venvDir} with Python 3.11`)
        if (!createVenvWith(py311)) {
          log.warn('[watcher] Recreate with Python 3.11 failed; falling back to system python')
          const sysPy = findSystemPython()
          const mk = spawnSync(sysPy, ['-m', 'venv', venvDir], { encoding: 'utf8' })
          if (mk.status !== 0) {
            log.warn(`[watcher] venv creation with system python failed: ${mk.stderr || mk.stdout}`)
            const v2 = readNvflareVersion(sysPy)
            if (!v2.ok || v2.version !== REQUIRED_NVFLARE) {
              if (!installNvflare(sysPy, REQUIRED_NVFLARE, log)) {
                log.warn(`[watcher] Proceeding with system python (${sysPy}) despite nvflare mismatch.`)
              }
            }
            return sysPy
          }
        }
      } else {
        log.warn('[watcher] Python 3.11 not found; recreating with system python instead.')
        const sysPy = findSystemPython()
        const mk = spawnSync(sysPy, ['-m', 'venv', venvDir], { encoding: 'utf8' })
        if (mk.status !== 0) {
          log.warn(`[watcher] venv creation with system python failed: ${mk.stderr || mk.stdout}`)
          const v2 = readNvflareVersion(sysPy)
          if (!v2.ok || v2.version !== REQUIRED_NVFLARE) {
            if (!installNvflare(sysPy, REQUIRED_NVFLARE, log)) {
              log.warn(`[watcher] Proceeding with system python (${sysPy}) despite nvflare mismatch.`)
            }
          }
          return sysPy
        }
      }
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
  const pyV = readPythonVersion(pythonInVenv)
  log.info(`[watcher] Using ADMIN_PY: ${pythonInVenv} (Python ${pyV.ok ? `${pyV.major}.${pyV.minor}` : 'unknown'}, nvflare ${finalV.version ?? 'unknown'})`)
  return pythonInVenv
}

/* ---------------- meta plumbing (unchanged) ---------------- */

type WatcherJson = {
  ts?: string
  status?: string
  deploy_status?: Record<string, string>
  connected_clients?: string[]
  connected_clients_detailed?: Array<{ id?: string }>
  job_id?: string | null
  round?: number | null
}

function shortId(id: string): string {
  return id.slice(-4)
}

function buildDisplayLine(now: Date, j: WatcherJson): string {
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')

  const status = j.status ?? 'UNKNOWN'
  const server = j.deploy_status?.server ?? 'UNKNOWN'
  const ids = (j.connected_clients ?? []).map(shortId)
  const clients = ids.length
  const list = ids.join(', ')
  return `[${hh}:${mm}:${ss}] ${status} | server: ${server} | clients: ${clients} (${list})`
}

let lastSentKey = ''
let lastSentAt = 0

async function tryReport(runId: string, j: WatcherJson, log: { info: Function; warn: Function }) {
  const now = new Date()
  const display = buildDisplayLine(now, j)
  const meta = {
    phase: j.status ?? 'UNKNOWN',
    server: j.deploy_status?.server ?? 'UNKNOWN',
    clients: Array.isArray(j.connected_clients) ? j.connected_clients.length : 0,
    clientIds: j.connected_clients ?? [],
    jobId: j.job_id ?? null,
    round: j.round ?? null,
    display,
    t: j.ts ?? now.toISOString(),
  }

  const key = JSON.stringify(meta)
  const tNow = Date.now()
  if (key === lastSentKey && tNow - lastSentAt < 1000) return
  lastSentKey = key
  lastSentAt = tNow

  try {
    await reportRunMeta({ runId, meta })
  } catch (e) {
    log.warn(`[watcher] reportRunMeta failed ${e instanceof Error ? e.message : String(e)}`)
  }
}

/* ---------------- spawn & scheduler (unchanged except logs) ---------------- */

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
  const log = opts.logger ?? defaultLogger ?? console
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
    forceInternalAdmin = true,
    forceAdminHost = 'host.docker.internal',
    forceAdminPort = 3011,
  } = opts

  const startupDir =
    startupOverride ||
    path.join(root, 'runs', consortiumId, runId, 'runKits', 'centralNode', 'admin', 'startup')

  const args = [
    '-u',
    watcherScript,
    '--poll', String(pollSec),
    '--drain-window', String(drainWindowSec),
    '--unreach-exit', String(Math.max(0, unreachExit)),
    showClients ? '--show-clients' : '',
    pretty ? '--pretty' : '',
    resilient ? '--resilient' : '',
    ...(forceInternalAdmin ? ['--use-internal-admin', '--force-host', forceAdminHost, '--force-admin-port', String(forceAdminPort)] : []),
    '--consortium', consortiumId,
    '--run', runId,
    '--insecure',
    '--startup', startupDir,
    ...extraArgs,
  ].filter(Boolean)

  log.info('[watcher:ARGS]', args.join(' '))

  const spawnOpts: SpawnOptions = {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(opts.env ?? {}) },
    cwd: path.dirname(watcherScript),
  }

  log.info(`[watcher:${tag}] ${python} ${args.join(' ')}`)
  const child = spawn(python, args, spawnOpts)

  let bufOut = ''
  if (child.stdout) {
    child.stdout.on('data', (buf: Buffer) => {
      bufOut += buf.toString('utf8')
      let idx: number
      while ((idx = bufOut.indexOf('\n')) >= 0) {
        const line = bufOut.slice(0, idx).trim()
        bufOut = bufOut.slice(idx + 1)
        if (!line) continue

        log.info(`[watcher:${tag}] ${line}`)

        if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const payload = JSON.parse(line) as WatcherJson
            void tryReport(runId, payload, log)
          } catch {
            /* ignore parse errors; line already logged */
          }
        }
      }
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
  const log = opts.logger ?? defaultLogger ?? console
  if (delayMs) log.info(`[watcher:${opts.tag ?? 'RUN'}] delaying start by ${Math.round(delayMs / 1000)}s`)
  if (delayMs) await sleep(delayMs)
  return spawnNvflareWatcher(opts, importMetaUrl)
}
