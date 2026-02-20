// NeuroFLAME edgeFederatedClient/src/runtime/runtimeManager.ts
//
// Managed Python runtime for observer nodes (no Docker).
//
// Key behavior:
// - NVFlare 2.4.0 effectively requires Python <= 3.10 (due to pinned deps like SQLAlchemy==1.4.31).
// - We create/manage a venv under `${pathBaseDirectory}/.runtime/venv`.
// - We install `nvflare==2.4.0` into that venv if missing.
// - We DO NOT treat NEUROFLAME_PYTHON as an override, because runStart sets it to the managed venv python.
//   Instead, users can override with NEUROFLAME_PYTHON_OVERRIDE.

import { spawnSync } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from '../logger.js'

type EnsureRuntimeResult = {
  pythonPath: string
  venvPath: string
  pythonVersion: string
}

const NVFLARE_VERSION = '2.4.0'

function isWindows() {
  return process.platform === 'win32'
}

function venvPythonPath(venvPath: string) {
  return isWindows()
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python')
}

type Cmd = { cmd: string; argsPrefix: string[]; label: string }

function run(cmd: string, args: string[], quiet = false) {
  return spawnSync(cmd, args, {
    encoding: 'utf-8',
    env: {
      ...process.env,
      PIP_DISABLE_PIP_VERSION_CHECK: '1',
      PIP_NO_INPUT: '1',
    },
    stdio: quiet ? 'pipe' : 'pipe',
  })
}

function assertOk(r: ReturnType<typeof run>, context: string) {
  if (r.status === 0) return
  const out = (r.stdout || '').trim()
  const err = (r.stderr || '').trim()
  throw new Error(
    `${context} failed (exit=${r.status}).` +
      (out ? `\n--- stdout ---\n${out}` : '') +
      (err ? `\n--- stderr ---\n${err}` : ''),
  )
}

async function exists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function parseMajorMinor(ver: string): { maj: number; min: number } | null {
  const parts = ver.split('.').map((n) => parseInt(n, 10))
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null
  return { maj: parts[0], min: parts[1] }
}

function getPythonVersion(pythonCmd: Cmd): string | null {
  const r = run(
    pythonCmd.cmd,
    [...pythonCmd.argsPrefix, '-c', 'import sys; print(".".join(map(str, sys.version_info[:3])))'],
    true,
  )
  if (r.status !== 0) return null
  return (r.stdout || '').trim()
}

function getExeVersion(exe: string): string | null {
  const r = run(exe, ['-c', 'import sys; print(".".join(map(str, sys.version_info[:3])))'], true)
  if (r.status !== 0) return null
  return (r.stdout || '').trim()
}

function isCompatibleForNvflare240(ver: string): boolean {
  const mm = parseMajorMinor(ver)
  if (!mm) return false
  return mm.maj === 3 && mm.min <= 10
}

function pickSupportedPython(): { python: Cmd; version: string } {
  const candidates: Cmd[] = isWindows()
    ? [
        { cmd: 'py', argsPrefix: ['-3.10'], label: 'py -3.10' },
        { cmd: 'py', argsPrefix: ['-3.9'], label: 'py -3.9' },
        // Some environments provide these shims even on Windows:
        { cmd: 'python3.10', argsPrefix: [], label: 'python3.10' },
        { cmd: 'python3.9', argsPrefix: [], label: 'python3.9' },
        // last resort:
        { cmd: 'python', argsPrefix: [], label: 'python' },
      ]
    : [
        { cmd: 'python3.10', argsPrefix: [], label: 'python3.10' },
        { cmd: 'python3.9', argsPrefix: [], label: 'python3.9' },
        // last resort:
        { cmd: 'python3', argsPrefix: [], label: 'python3' },
      ]

  const found: Array<{ python: Cmd; version: string }> = []
  for (const c of candidates) {
    const ver = getPythonVersion(c)
    if (ver) found.push({ python: c, version: ver })
  }

  if (found.length === 0) {
    throw new Error(
      `[runtime] No usable Python found.\n` +
        `For NVFlare ${NVFLARE_VERSION}, install Python 3.10 (recommended) or 3.9.\n` +
        `Or set NEUROFLAME_PYTHON_OVERRIDE to a Python 3.10/3.9 interpreter.`,
    )
  }

  const ok = found.filter((x) => isCompatibleForNvflare240(x.version))
  if (ok.length === 0) {
    const versions = found.map((x) => `${x.python.label}=>${x.version}`).join(', ')
    throw new Error(
      `[runtime] Found Python versions, but none compatible with NVFlare ${NVFLARE_VERSION}.\n` +
        `Detected: ${versions}\n` +
        `Install Python 3.10 (recommended) or 3.9 and retry, or set NEUROFLAME_PYTHON_OVERRIDE.`,
    )
  }

  // candidates are ordered by preference; ok keeps that order
  return ok[0]
}

function canImportNvflare(pythonExe: string): boolean {
  const r = run(pythonExe, ['-c', 'import nvflare; print(nvflare.__version__)'], true)
  return r.status === 0
}

function pipInstallNvflare(pythonExe: string) {
  // Ensure tooling (pkg_resources comes from setuptools)
  assertOk(
    run(pythonExe, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel']),
    '[runtime] upgrade pip/setuptools/wheel',
  )

  // IMPORTANT: Do NOT use --only-binary=:all: here.
  // SQLAlchemy==1.4.31 (pinned by nvflare 2.4.0) may need to install from sdist on some platforms.
  const r = run(pythonExe, [
    '-m',
    'pip',
    'install',
    '--disable-pip-version-check',
    '--no-input',
    `nvflare==${NVFLARE_VERSION}`,
  ])

  assertOk(r, '[runtime] pip install nvflare')
}

export async function ensureObserverRuntime(pathBaseDirectory: string): Promise<EnsureRuntimeResult> {
  // Optional override: user can specify a python interpreter explicitly.
  // IMPORTANT: runStart will set NEUROFLAME_PYTHON to the managed venv python. Do not treat that as override.
  const override = (process.env.NEUROFLAME_PYTHON_OVERRIDE || '').trim()
  if (override) {
    const ver = getExeVersion(override)
    if (!ver) throw new Error(`[runtime] NEUROFLAME_PYTHON_OVERRIDE set but not runnable: ${override}`)

    if (!isCompatibleForNvflare240(ver)) {
      throw new Error(
        `[runtime] NEUROFLAME_PYTHON_OVERRIDE points to Python ${ver}.\n` +
          `For NVFlare ${NVFLARE_VERSION}, use Python 3.10 (recommended) or 3.9.`,
      )
    }

    if (!canImportNvflare(override)) {
      logger.info('[runtime] nvflare missing in override python; installing', { override, ver })
      pipInstallNvflare(override)
    }

    if (!canImportNvflare(override)) {
      throw new Error('[runtime] nvflare still not importable after install in override python')
    }

    return { pythonPath: override, venvPath: '(override)', pythonVersion: ver }
  }

  const runtimeRoot = path.join(pathBaseDirectory, '.runtime')
  const venvPath = path.join(runtimeRoot, 'venv')
  const venvPy = venvPythonPath(venvPath)

  await fs.mkdir(runtimeRoot, { recursive: true })

  // If venv exists but is incompatible (>=3.11), delete and recreate.
  if (await exists(venvPy)) {
    const ver = getExeVersion(venvPy)
    if (ver && !isCompatibleForNvflare240(ver)) {
      logger.warn('[runtime] existing venv python is incompatible; removing', { venvPath, ver })
      await fs.rm(venvPath, { recursive: true, force: true })
    }
  }

  // Create venv if missing
  if (!(await exists(venvPy))) {
    const chosen = pickSupportedPython()
    logger.info('[runtime] creating observer venv', {
      venvPath,
      using: chosen.python.label,
      version: chosen.version,
    })
    const rVenv = run(chosen.python.cmd, [...chosen.python.argsPrefix, '-m', 'venv', venvPath])
    assertOk(rVenv, '[runtime] python -m venv')

    if (!(await exists(venvPy))) {
      throw new Error(`[runtime] venv created but python not found at expected path: ${venvPy}`)
    }
  }

  // Confirm venv version is <=3.10
  const venvVer = getExeVersion(venvPy)
  if (!venvVer) throw new Error('[runtime] venv python not runnable')
  if (!isCompatibleForNvflare240(venvVer)) {
    throw new Error(
      `[runtime] venv python is ${venvVer} (incompatible). Install Python 3.10/3.9 and retry.`,
    )
  }

  if (!canImportNvflare(venvPy)) {
    logger.info('[runtime] installing nvflare', { nvflare: NVFLARE_VERSION })
    pipInstallNvflare(venvPy)
  }

  const check = run(venvPy, ['-c', 'import nvflare; print(nvflare.__version__)'], true)
  assertOk(check, '[runtime] nvflare import failed')

  logger.info('[runtime] observer runtime ready', {
    python: venvPy,
    pythonVersion: venvVer,
    nvflareVersion: (check.stdout || '').trim(),
  })

  return { pythonPath: venvPy, venvPath, pythonVersion: venvVer }
}
