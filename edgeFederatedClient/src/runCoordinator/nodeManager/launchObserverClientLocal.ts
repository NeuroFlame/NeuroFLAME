// edgeFederatedClient/src/runCoordinator/nodeManager/launchObserverClientLocal.ts

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { logger } from '../../logger.js'

export type ParticipantRole = 'observer' | 'contributor' | 'unknown'

export interface LaunchObserverArgs {
  runKitPath: string
  consortiumId: string
  runId: string
  role: ParticipantRole
  fileServerUrl: string

  /**
   * JWT used by fileServer middleware decodeAndValidateJWT via header "x-access-token".
   * This should be the same access token used by contributors (inMemoryStore.get('accessToken')).
   */
  accessToken: string

  pythonPath?: string
}

async function exists(p: string): Promise<boolean> {
  try {
    await fsp.access(p)
    return true
  } catch {
    return false
  }
}

async function findStartupDir(runKitPath: string): Promise<string> {
  const candidates = [path.join(runKitPath, 'startup'), path.join(runKitPath, 'client', 'startup')]

  for (const d of candidates) {
    if ((await exists(path.join(d, 'sub_start.sh'))) && (await exists(path.join(d, 'fed_client.json')))) {
      return d
    }
  }

  // fallback: shallow scan
  const maxDepth = 5
  async function walk(dir: string, depth: number): Promise<string | null> {
    if (depth > maxDepth) return null
    let entries: fs.Dirent[]
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      return null
    }

    const hasFed = entries.some((e) => e.isFile() && e.name === 'fed_client.json')
    const hasSub = entries.some((e) => e.isFile() && e.name === 'sub_start.sh')
    if (hasFed && hasSub) return dir

    for (const e of entries) {
      if (!e.isDirectory()) continue
      if (['.git', 'node_modules', '__MACOSX', '__pycache__'].includes(e.name)) continue
      const found = await walk(path.join(dir, e.name), depth + 1)
      if (found) return found
    }
    return null
  }

  const found = await walk(runKitPath, 0)
  if (found) return found
  throw new Error(`Could not find startup dir with sub_start.sh + fed_client.json under ${runKitPath}`)
}

type ParsedSubStart = {
  moduleName: string
  configArg: string
  setArgs: string[]
  uid: string
}

function parseSubStartSh(text: string): ParsedSubStart {
  // Typical:
  // python3 -u -m nvflare.private.fed.app.client.client_train -m $DIR/.. -s fed_client.json --set secure_train=true uid=... org=nvidia config_folder=config
  const m = text.match(
    /python[0-9.]*\s+-u\s+-m\s+([^\s]+)\s+-m\s+([^\s]+)\s+-s\s+([^\s]+)\s+--set\s+([^\n\r]+)/
  )
  if (!m) throw new Error('Could not parse nvflare command line from sub_start.sh')

  const moduleName = m[1].trim()
  const configArg = m[3].trim()
  const setArgs = m[4].trim().split(/\s+/).filter(Boolean)

  const uidTok = setArgs.find((t) => t.startsWith('uid='))
  const uid = uidTok?.split('=')[1]
  if (!uid) throw new Error('Could not parse uid=... from sub_start.sh --set args')

  return { moduleName, configArg, setArgs, uid }
}

async function writeObserverBootstrap(runKitPath: string): Promise<string> {
  // Python auto-imports sitecustomize if it’s on sys.path; we use it to find app/code dirs.
  const bootstrapDir = path.join(runKitPath, '_observer_bootstrap')
  await fsp.mkdir(bootstrapDir, { recursive: true })

  const sitecustomizePath = path.join(bootstrapDir, 'sitecustomize.py')
  const sitecustomize = `
import os, sys
from pathlib import Path

def _add(p: Path):
    try:
        sp = str(p)
        if p.exists() and sp not in sys.path:
            sys.path.insert(0, sp)
    except Exception:
        pass

def _looks_like_app_code_dir(p: Path) -> bool:
    try:
        return (p / "executor").exists() and (p / "executor").is_dir()
    except Exception:
        return False

def _scan(base: Path):
    max_depth = 6
    stack = [(base, 0)]
    while stack:
        d, depth = stack.pop()
        if depth > max_depth:
            continue
        try:
            entries = list(d.iterdir())
        except Exception:
            continue

        candidates = []
        candidates.append(d / "app" / "code")
        candidates.append(d / "code")

        for c in candidates:
            if _looks_like_app_code_dir(c):
                _add(c)

        for e in entries:
            if not e.is_dir():
                continue
            name = e.name
            if name in (".git", "__pycache__", "node_modules", "__MACOSX"):
                continue
            stack.append((e, depth + 1))

base = os.getenv("NEUROFLAME_RUNKIT_PATH") or os.getenv("WORKSPACE") or os.getcwd()
_scan(Path(base))

if os.getenv("NEUROFLAME_OBSERVER_BOOTSTRAP_DEBUG") == "true":
    sys.stderr.write("[observer-bootstrap] sys.path=\\n" + "\\n".join(sys.path) + "\\n")
`.trimStart()

  await fsp.writeFile(sitecustomizePath, sitecustomize, 'utf-8')
  return bootstrapDir
}

export async function launchObserverClientLocal(args: LaunchObserverArgs): Promise<{ pid: number }> {
  const { runKitPath, consortiumId, runId, role, fileServerUrl, accessToken, pythonPath } = args

  if (!accessToken) {
    throw new Error('launchObserverClientLocal: accessToken is required (fileServer auth uses x-access-token)')
  }

  const startupDir = await findStartupDir(runKitPath)
  const workspaceDir = path.resolve(startupDir, '..')

  const subStartPath = path.join(startupDir, 'sub_start.sh')
  const subStartText = await fsp.readFile(subStartPath, 'utf-8')
  const parsed = parseSubStartSh(subStartText)

  const py = pythonPath || process.env.NEUROFLAME_PYTHON || 'python3'

  // Desired output layout:
  // .../<consortiumId>/<runId>/results.zip
  // .../<consortiumId>/<runId>/results/<unzipped contents>
  const runDir = path.dirname(runKitPath) // runKitPath is .../<consortiumId>/<runId>/runKit
  const resultsZipPath = path.join(runDir, 'results.zip')
  const resultsExtractDir = path.join(runDir, 'results')
  await fsp.mkdir(resultsExtractDir, { recursive: true })

  const bootstrapDir = await writeObserverBootstrap(runKitPath)

  // Add any obvious local code dirs too (harmless if missing).
  const uidCodeDir = path.join(runKitPath, parsed.uid, 'code')
  const altAppCodeDir = path.join(runKitPath, 'app', 'code')
  const priorPyPath = process.env.PYTHONPATH ? String(process.env.PYTHONPATH) : ''
  const pyPathParts = [bootstrapDir]

  if (await exists(uidCodeDir)) pyPathParts.push(uidCodeDir)
  if (await exists(altAppCodeDir)) pyPathParts.push(altAppCodeDir)
  if (priorPyPath) pyPathParts.push(priorPyPath)

  const logsDir = path.join(runKitPath, '_observer_logs')
  await fsp.mkdir(logsDir, { recursive: true })
  const stdoutPath = path.join(logsDir, 'nvflare_stdout.log')
  const stderrPath = path.join(logsDir, 'nvflare_stderr.log')
  const stdoutStream = fs.createWriteStream(stdoutPath, { flags: 'a' })
  const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' })

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    WORKSPACE: workspaceDir,

    // critical: make executor.* importable + run bootstrap
    PYTHONPATH: pyPathParts.join(':'),
    NEUROFLAME_RUNKIT_PATH: runKitPath,

    // critical: allow ObserverExecutor to download results
    NEUROFLAME_FILESERVER_URL: fileServerUrl,
    NEUROFLAME_CONSORTIUM_ID: consortiumId,
    NEUROFLAME_RUN_ID: runId,

    // fileServer expects JWT in header "x-access-token"
    NEUROFLAME_ACCESS_TOKEN: accessToken,

    NEUROFLAME_PARTICIPANT_ROLE: role,

    // critical: output layout
    NEUROFLAME_RESULTS_ZIP_PATH: resultsZipPath,
    NEUROFLAME_RESULTS_EXTRACT_DIR: resultsExtractDir,
    NEUROFLAME_OBSERVER_RUN_DIR: runDir,
  }

  logger.info('[observer] launching NVFlare client locally (sub_start.sh)', {
    python: py,
    startupDir,
    workspaceDir,
    runKitPath,
    runDir,
    moduleName: parsed.moduleName,
    setArgs: parsed.setArgs,
    PYTHONPATH: childEnv.PYTHONPATH,
    resultsZipPath,
    resultsExtractDir,
    stdoutPath,
    stderrPath,
  })

  const cmdArgs = [
    '-u',
    '-m',
    parsed.moduleName,
    '-m',
    workspaceDir,
    '-s',
    parsed.configArg,
    '--set',
    ...parsed.setArgs,
  ]

  const proc = spawn(py, cmdArgs, {
    env: childEnv,
    cwd: startupDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  proc.stdout?.pipe(stdoutStream)
  proc.stderr?.pipe(stderrStream)

  proc.on('error', (err) => logger.error('[observer] spawn error', { err }))
  proc.on('exit', (code, signal) =>
    logger.warn('[observer] NVFlare exited', { code, signal, stdoutPath, stderrPath })
  )

  if (!proc.pid) throw new Error('Failed to spawn observer NVFlare client (missing pid)')
  proc.unref()
  return { pid: proc.pid }
}
