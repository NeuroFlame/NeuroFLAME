#!/usr/bin/env node

'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn, spawnSync } = require('node:child_process')
const readline = require('node:readline/promises')
const process = require('node:process')
const WS = require('ws')

const PREPROCESSORS = {
  'vbm-pre': {
    image: 'coinstacteam/vbm_pre',
    compspecPath: path.resolve(__dirname, '..', 'specs', 'vbm-pre.compspec.json'),
  },
}

const PRE_RUN_FILE = 'nfPreRun.json'
const OUTPUT_ROOT_DIR = 'nfPreOutput'
const FIXED_PREPROCESS_ID = 'vbm-pre'
const FIXED_CLIENT_ID = 'local0'
const FIXED_ITERATION = 1
const FIXED_MODE = 'local'
const FIXED_CONTAINER_PORT = 8881
const FIXED_TIMEOUT_MS = 8 * 60 * 60 * 1000
const ALT_DATA_MOUNT_OUT = '/nfPreData'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      continue
    }
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      args[key] = next
      i += 1
    } else {
      args[key] = 'true'
    }
  }
  return args
}

function randomPort() {
  return 19000 + Math.floor(Math.random() * 1000)
}

function normalizePathInput(value) {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function colorEnabled() {
  return process.stdout.isTTY && process.env.NO_COLOR === undefined
}

function style(text, code) {
  if (!colorEnabled()) {
    return text
  }
  return `\x1b[${code}m${text}\x1b[0m`
}

function section(title) {
  return style(title, '1;36')
}

function flag(name) {
  return style(name, '1;33')
}

function value(text) {
  return style(text, '0;32')
}

function note(text) {
  return style(text, '2')
}

function printUsage() {
  console.log([
    style('NFPREPROCESSOR(1)', '1;37'),
    note('Local COINSTAC preprocessing runner'),
    '',
    section('NAME'),
    '  nfpreprocessor - guided local preprocessing runner',
    '',
    section('SYNOPSIS'),
    `  ${flag('nfpreprocessor')} [${flag('--pre-run')} ${value('<json-file>')}] [${flag('--covariates-csv')} ${value('<file>')}]`,
    `                 [${flag('--workspace')} ${value('<dir>')}] [${flag('--dry-run')}] [${flag('--hard-links')}] [${flag('--singularity')}]`,
    '',
    section('DESCRIPTION'),
    '  Run legacy preprocessing containers with a simplified guided workflow.',
    '  Running without flags starts interactive setup.',
    '',
    section('OPTIONS'),
    ...Object.entries(PREPROCESSORS).map(([id, conf]) => `  Built-in computation: ${value(id)} (${conf.image})`),
    `  ${flag('--pre-run')} ${value('<json-file>')}`,
    '      Run from an existing pre-run file.',
    `  ${flag('--covariates-csv')} ${value('<file>')}`,
    '      Build run input from covariates CSV metadata.',
    `  ${flag('--workspace')} ${value('<dir>')}`,
    '      Override output workspace root.',
    `  ${flag('--dry-run')}`,
    '      Print merged input payload and exit without Docker run.',
    `  ${flag('--hard-links')}`,
    '      Use hard links instead of symlink+alternate mount staging.',
    `  ${flag('--singularity')}`,
    '      Use singularity/apptainer runtime and cached .sif image.',
    '',
    section('OPERATION'),
    `  1. Run in a directory containing data and ${value('covariates.csv')}.`,
    `  2. Tool creates/uses ${value('nfPreRun.json')}.`,
    '  3. If pre-run exists, choose reuse or regenerate (old file archived).',
    `  4. Run output is written to ${value('nfPreOutput/<computation>-<timestamp>/')}.`,
    '',
    section('FILES'),
    `  ${value('nfPreRun.json')}               Active pre-run config`,
    `  ${value('nfPreRun-<timestamp>.json')}   Archived pre-run config`,
    `  ${value('nfPreOutput/.../output')}      Computation outputs`,
    `  ${value('nfPreOutput/.../runner-response.json')}   Final container message`,
    '',
    section('EXAMPLES'),
    `  ${flag('nfpreprocessor')}`,
    `  ${flag('nfpreprocessor')} ${flag('--covariates-csv')} ./covariates.csv`,
    `  ${flag('nfpreprocessor')} ${flag('--pre-run')} ./nfPreRun.json`,
    `  ${flag('nfpreprocessor')} ${flag('--covariates-csv')} ./covariates.csv ${flag('--dry-run')}`,
    `  ${flag('nfpreprocessor')} ${flag('--covariates-csv')} ./covariates.csv ${flag('--singularity')}`,
    '',
    section('NOTES'),
    `  Docker must be installed and running unless ${flag('--singularity')} is used.`,
    `  Singularity image cache location: ${value('nfPreOutput/images')}.`,
  ].join('\n'))
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function getDefaultValue(paramSpec) {
  if (!paramSpec || typeof paramSpec !== 'object') {
    return undefined
  }
  if (!Object.prototype.hasOwnProperty.call(paramSpec, 'default')) {
    return undefined
  }
  return paramSpec.default
}

function buildDefaultInputFromCompspec(compspec) {
  const inputSpec = compspec?.computation?.input
  const defaults = {}
  if (!inputSpec || typeof inputSpec !== 'object') {
    return defaults
  }
  for (const [key, value] of Object.entries(inputSpec)) {
    const defaultValue = getDefaultValue(value)
    if (defaultValue !== undefined) {
      defaults[key] = defaultValue
    }
  }
  return defaults
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }
    current += char
  }
  values.push(current)
  return values.map((entry) => entry.trim())
}

async function parseCovariatesCsv(csvPath) {
  const raw = await fs.readFile(csvPath, 'utf8')
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    throw new Error(`Covariates CSV must contain header and at least one row: ${csvPath}`)
  }

  const header = parseCsvLine(lines[0])
  const filenameIdx = header.findIndex((field) => field.toLowerCase() === 'filename')
  if (filenameIdx < 0) {
    throw new Error(`Covariates CSV must include a "filename" column: ${csvPath}`)
  }

  const covariates = {}
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i])
    const filename = row[filenameIdx]
    if (!filename) {
      continue
    }
    const meta = {}
    header.forEach((column, colIdx) => {
      if (colIdx === filenameIdx) {
        return
      }
      meta[column] = row[colIdx] ?? ''
    })
    covariates[filename] = meta
  }
  return covariates
}

async function buildInputFromPreRunFile(preRunPath) {
  const preRun = await readJson(preRunPath)
  if (preRun?.input && typeof preRun.input === 'object') {
    return preRun.input
  }
  throw new Error(`Pre-run file must include an "input" object: ${preRunPath}`)
}

function buildMessage({ inputData, clientId, iteration, mode }) {
  return {
    mode,
    data: {
      input: inputData,
      cache: {},
      state: {
        baseDirectory: '/input',
        outputDirectory: '/output',
        cacheDirectory: '/tmp',
        transferDirectory: '/tmp',
        clientId,
        iteration,
      },
    },
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function removeDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true })
}

async function stageCovariateFiles(inputData, inputRoot, runInputDir, useHardLinks) {
  const covariates = inputData.covariates
  if (!covariates || typeof covariates !== 'object' || Array.isArray(covariates)) {
    return {
      files: [],
      useAlternateDataMount: false,
    }
  }

  const fileEntries = Object.keys(covariates)
  let useAlternateDataMount = !useHardLinks
  for (const relativeFile of fileEntries) {
    const sourcePath = path.isAbsolute(relativeFile) ? relativeFile : path.resolve(inputRoot, relativeFile)
    const targetPath = path.join(runInputDir, relativeFile)
    const sourceExists = await exists(sourcePath)
    if (!sourceExists) {
      throw new Error(`Missing covariate file: ${sourcePath}`)
    }

    await ensureDir(path.dirname(targetPath))

    const stats = await fs.stat(sourcePath)
    if (!stats.isFile()) {
      throw new Error(`Covariate path must be a file: ${sourcePath}`)
    }

    const sourceRelativeToRoot = path.relative(inputRoot, sourcePath)
    if (sourceRelativeToRoot.startsWith('..') || path.isAbsolute(sourceRelativeToRoot)) {
      throw new Error(`File is outside input root: ${sourcePath}`)
    }
    const posixRelative = sourceRelativeToRoot.split(path.sep).join('/')

    if (useHardLinks) {
      try {
        await fs.link(sourcePath, targetPath)
      } catch (error) {
        if (error.code === 'EXDEV') {
          throw new Error(`Cannot hard-link across filesystems: ${sourcePath}. Re-run without --hard-links.`)
        }
        throw error
      }
    } else {
      const symlinkTarget = `${ALT_DATA_MOUNT_OUT}/${posixRelative}`
      await fs.symlink(symlinkTarget, targetPath)
    }
  }

  return {
    files: fileEntries,
    useAlternateDataMount,
  }
}

function spawnDockerRun({
  image,
  containerName,
  hostPort,
  containerPort,
  mountRoot,
  alternateDataMountRoot,
}) {
  const inputHost = path.join(mountRoot, 'input')
  const outputHost = path.join(mountRoot, 'output')

  const dockerArgs = [
    'run',
    '--rm',
    '--name',
    containerName,
    '-p',
    `${hostPort}:${containerPort}`,
    '-e',
    `COINSTAC_PORT=${containerPort}`,
    '-v',
    `${inputHost}:/input:ro`,
    '-v',
    `${outputHost}:/output:rw`,
    image,
  ]

  if (alternateDataMountRoot) {
    dockerArgs.splice(dockerArgs.length - 1, 0, '-v', `${alternateDataMountRoot}:${ALT_DATA_MOUNT_OUT}:ro`)
  }

  const child = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (chunk) => process.stdout.write(`[container] ${chunk.toString()}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[container] ${chunk.toString()}`))
  return child
}

async function stopContainer(containerName) {
  await new Promise((resolve) => {
    const child = spawn('docker', ['stop', containerName], { stdio: 'ignore' })
    child.on('close', () => resolve())
    child.on('error', () => resolve())
  })
}

function detectSingularityOrApptainer() {
  const singularityCheck = spawnSync('which', ['singularity'])
  if (singularityCheck.status === 0) {
    return 'singularity'
  }
  const apptainerCheck = spawnSync('which', ['apptainer'])
  if (apptainerCheck.status === 0) {
    return 'apptainer'
  }
  return null
}

function toLocalSingularityImageName(dockerImage) {
  return dockerImage
    .replace(/:latest$/, '')
    .replace(/[/:@]/g, '_')
    .toLowerCase()
}

async function ensureSingularityImage(dockerImage, imagesDirectory) {
  const singularityBinary = detectSingularityOrApptainer()
  if (!singularityBinary) {
    throw new Error('Neither singularity nor apptainer was found in PATH.')
  }

  await ensureDir(imagesDirectory)
  const imageFileName = `${toLocalSingularityImageName(dockerImage)}.sif`
  const imagePath = path.join(imagesDirectory, imageFileName)

  if (await exists(imagePath)) {
    return {
      singularityBinary,
      imagePath,
      pulled: false,
    }
  }

  await new Promise((resolve, reject) => {
    const pullProcess = spawn(
      singularityBinary,
      ['pull', imagePath, `docker://${dockerImage}`],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )

    pullProcess.stdout.on('data', (chunk) => {
      process.stdout.write(`[singularity-pull] ${chunk.toString()}`)
    })
    pullProcess.stderr.on('data', (chunk) => {
      process.stdout.write(`[singularity-pull] ${chunk.toString()}`)
    })
    pullProcess.on('error', (error) => reject(error))
    pullProcess.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${singularityBinary} pull failed with exit code ${code}`))
      }
    })
  })

  return {
    singularityBinary,
    imagePath,
    pulled: true,
  }
}

function spawnSingularityRun({
  singularityBinary,
  imagePath,
  hostPort,
  mountRoot,
  alternateDataMountRoot,
}) {
  const inputHost = path.join(mountRoot, 'input')
  const outputHost = path.join(mountRoot, 'output')
  const binds = [
    `${inputHost}:/input:ro`,
    `${outputHost}:/output:rw`,
    '/tmp:/tmp:rw',
  ]
  if (alternateDataMountRoot) {
    binds.push(`${alternateDataMountRoot}:${ALT_DATA_MOUNT_OUT}:ro`)
  }

  const args = [
    'run',
    '--containall',
    '--writable-tmpfs',
    '-e',
    '--env',
    `PYTHONUNBUFFERED=1,COINSTAC_PORT=${hostPort}`,
    '-B',
    binds.join(','),
    imagePath,
  ]

  const child = spawn(singularityBinary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (chunk) => process.stdout.write(`[container] ${chunk.toString()}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[container] ${chunk.toString()}`))
  return child
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseDockerStatsLine(statsLine) {
  try {
    return JSON.parse(statsLine.trim())
  } catch {
    return null
  }
}

async function getContainerStats(containerName) {
  return new Promise((resolve) => {
    const child = spawn(
      'docker',
      ['stats', '--no-stream', '--format', '{{json .}}', containerName],
      { stdio: ['ignore', 'pipe', 'ignore'] }
    )
    let stdout = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.on('close', () => {
      resolve(parseDockerStatsLine(stdout))
    })
    child.on('error', () => {
      resolve(null)
    })
  })
}

function formatStatsLine(stats, startedAtMs) {
  const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
  const elapsed = `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
  if (!stats) {
    return `Stats | elapsed ${elapsed} | waiting for container metrics...`
  }
  return [
    'Stats',
    `elapsed ${elapsed}`,
    `CPU ${stats.CPUPerc}`,
    `MEM ${stats.MemUsage} (${stats.MemPerc})`,
    `NET ${stats.NetIO}`,
    `PIDS ${stats.PIDs}`,
  ].join(' | ')
}

function startStatsDisplay(containerName) {
  if (!process.stdout.isTTY) {
    return () => {}
  }

  let cancelled = false
  const startedAtMs = Date.now()
  let ticker

  const tick = async () => {
    if (cancelled) {
      return
    }
    const stats = await getContainerStats(containerName)
    if (cancelled) {
      return
    }
    const line = formatStatsLine(stats, startedAtMs)
    process.stdout.write(`\r\x1b[2K${line}`)
    ticker = setTimeout(tick, 1000)
  }

  tick().catch(() => {})

  return () => {
    cancelled = true
    if (ticker) {
      clearTimeout(ticker)
    }
    process.stdout.write('\r\x1b[2K')
  }
}

async function waitForWebSocket(url, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const socket = await new Promise((resolve, reject) => {
        const ws = new WS(url)
        const timeout = setTimeout(() => {
          ws.close()
          reject(new Error('WebSocket connect timeout'))
        }, 2000)
        ws.on('open', () => {
          clearTimeout(timeout)
          resolve(ws)
        })
        ws.on('error', () => {
          clearTimeout(timeout)
          reject(new Error('WebSocket connection failed'))
        })
      })
      return socket
    } catch {
      await sleep(500)
    }
  }
  throw new Error(`Timed out waiting for websocket server at ${url}`)
}

async function runMessage(socket, message, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        socket.close()
      } catch {}
      reject(new Error(`Timed out waiting for computation response after ${timeoutMs}ms`))
    }, timeoutMs)

    socket.on('message', (data) => {
      let parsed
      try {
        parsed = JSON.parse(data.toString())
      } catch (error) {
        clearTimeout(timer)
        reject(new Error(`Invalid JSON response from container: ${error.message}`))
        return
      }

      if (!parsed.end) {
        return
      }
      clearTimeout(timer)
      resolve(parsed)
    })

    socket.on('error', () => {
      clearTimeout(timer)
      reject(new Error('WebSocket errored while waiting for computation response'))
    })

    socket.send(JSON.stringify(message))
  })
}

async function dockerReady() {
  return new Promise((resolve) => {
    const child = spawn('docker', ['info'], { stdio: 'ignore' })
    child.on('close', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}

function hasExplicitInputArgs(args) {
  return Boolean(args['pre-run'] || args['covariates-csv'])
}

function timestampTag() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function outputRunDirectoryName(preprocessId) {
  return `${preprocessId}-${timestampTag()}`
}

async function writePreRunCopy(workspace, preRunConfig) {
  const preRunOutputPath = path.join(workspace, PRE_RUN_FILE)
  await fs.writeFile(preRunOutputPath, `${JSON.stringify(preRunConfig, null, 2)}\n`)
  return preRunOutputPath
}

async function firstMissingCovariatePath(covariates, inputRoot) {
  const filenames = Object.keys(covariates || {})
  for (const filename of filenames) {
    const candidate = path.resolve(inputRoot, filename)
    if (!(await exists(candidate))) {
      return candidate
    }
  }
  return null
}

async function findCsvCandidates(baseDir) {
  const entries = await fs.readdir(baseDir, { withFileTypes: true })
  const csvs = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
    .map((entry) => path.join(baseDir, entry.name))
  csvs.sort((a, b) => {
    const aBase = path.basename(a).toLowerCase()
    const bBase = path.basename(b).toLowerCase()
    if (aBase === 'covariates.csv') return -1
    if (bBase === 'covariates.csv') return 1
    return aBase.localeCompare(bBase)
  })
  return csvs
}

async function resolveInputRoot(covariates, preferredRoots) {
  for (const root of preferredRoots) {
    if (!root) continue
    const missing = await firstMissingCovariatePath(covariates, root)
    if (!missing) {
      return root
    }
  }
  return null
}

async function choosePreprocessor(rl) {
  const preprocessId = FIXED_PREPROCESS_ID
  console.log(`Computation: ${preprocessId} (${PREPROCESSORS[preprocessId].image})`)
  await rl.question('Press Enter to continue: ')
  return preprocessId
}

async function selectCovariatesCsv(rl, cwd) {
  const candidates = await findCsvCandidates(cwd)
  if (candidates.length > 0) {
    console.log(`Detected CSV: ${path.basename(candidates[0])}`)
    const useDetected = await rl.question('Use this as covariates file? [Y/n]: ')
    if (!useDetected.trim() || useDetected.toLowerCase().startsWith('y')) {
      return candidates[0]
    }
  }
  while (true) {
    const entered = await rl.question('Path to covariates.csv: ')
    const resolved = path.resolve(cwd, normalizePathInput(entered))
    if (!(await exists(resolved))) {
      console.log(`File not found: ${resolved}`)
      continue
    }
    return resolved
  }
}

async function promptForInputRoot(rl, covariates, csvPath, cwd, initialRoot) {
  const csvDir = path.dirname(csvPath)
  const detectedRoot = await resolveInputRoot(covariates, [
    initialRoot ? path.resolve(cwd, initialRoot) : null,
    cwd,
    csvDir,
  ])

  if (detectedRoot) {
    const useDetected = await rl.question(`Detected data root: ${detectedRoot}. Use this path? [Y/n]: `)
    if (!useDetected.trim() || useDetected.toLowerCase().startsWith('y')) {
      return detectedRoot
    }
  }

  while (true) {
    const entered = await rl.question('Path to data root directory: ')
    const resolved = path.resolve(cwd, normalizePathInput(entered))
    const missing = await firstMissingCovariatePath(covariates, resolved)
    if (!missing) {
      return resolved
    }
    console.log(`Missing data file: ${missing}`)
    const retry = await rl.question('Try another path? [Y/n]: ')
    if (retry.toLowerCase().startsWith('n')) {
      throw new Error('Cannot continue without a valid data root path.')
    }
  }
}

async function archivePreRunFile(preRunPath) {
  const archivePath = path.join(
    path.dirname(preRunPath),
    `nfPreRun-${timestampTag()}.json`
  )
  await fs.rename(preRunPath, archivePath)
  return archivePath
}

async function buildInteractivePreRun({
  rl,
  cwd,
  preprocessId,
  compspec,
  requestedInputRoot = '.',
}) {
  const covariatesCsvPath = await selectCovariatesCsv(rl, cwd)
  const covariates = await parseCovariatesCsv(covariatesCsvPath)
  const inputRoot = await promptForInputRoot(rl, covariates, covariatesCsvPath, cwd, requestedInputRoot)

  const inputData = {
    ...buildDefaultInputFromCompspec(compspec),
    covariates,
  }

  return {
    schemaVersion: 1,
    preprocessId,
    createdAt: new Date().toISOString(),
    sources: {
      covariatesCsv: covariatesCsvPath,
      inputRoot,
    },
    input: inputData,
  }
}

async function runInteractiveMode({ args, cwd }) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.log('')
    console.log('nfPreprocessor guided setup')
    console.log('Press Enter to accept defaults shown in [brackets].')
    console.log('')

    const preprocessId = await choosePreprocessor(rl)
    const preprocess = PREPROCESSORS[preprocessId]
    if (!preprocess) {
      throw new Error(`Unknown preprocessor: ${preprocessId}`)
    }
    const compspecPath = preprocess.compspecPath
    const compspec = await readJson(compspecPath)
    const preRunPath = path.join(cwd, PRE_RUN_FILE)

    let preRun
    if (await exists(preRunPath)) {
      console.log(`Found existing ${PRE_RUN_FILE}.`)
      const choice = await rl.question('Use existing pre-run? [Y]es / [N]ew / [E]xit: ')
      const normalized = choice.trim().toLowerCase()
      if (normalized.startsWith('e')) {
        return null
      }
      if (normalized.startsWith('n')) {
        const archivePath = await archivePreRunFile(preRunPath)
        console.log(`Archived previous pre-run: ${path.basename(archivePath)}`)
        preRun = await buildInteractivePreRun({
          rl,
          cwd,
          preprocessId,
          compspec,
          requestedInputRoot: '.',
        })
        await fs.writeFile(preRunPath, `${JSON.stringify(preRun, null, 2)}\n`)
      } else {
        preRun = await readJson(preRunPath)
      }
    } else {
      preRun = await buildInteractivePreRun({
        rl,
        cwd,
        preprocessId,
        compspec,
        requestedInputRoot: '.',
      })
      await fs.writeFile(preRunPath, `${JSON.stringify(preRun, null, 2)}\n`)
      console.log(`Created pre-run file: ${PRE_RUN_FILE}`)
      const proceed = await rl.question('Run now? [Y]es / [N]o (edit pre-run first): ')
      if (proceed.trim().toLowerCase().startsWith('n')) {
        console.log(`Edit ${PRE_RUN_FILE} and run again when ready.`)
        return null
      }
    }

    const workspace = path.join(cwd, OUTPUT_ROOT_DIR, outputRunDirectoryName(preprocessId))

    return {
      preprocessId,
      compspecPath,
      image: compspec?.computation?.dockerImage || preprocess.image,
      // keep a dated per-run workspace under nfPreOutput
      workspace,
      preRunConfig: preRun,
      message: buildMessage({
        inputData: preRun.input || {},
        clientId: FIXED_CLIENT_ID,
        iteration: FIXED_ITERATION,
        mode: FIXED_MODE,
      }),
      inputRoot: preRun?.sources?.inputRoot ? path.resolve(preRun.sources.inputRoot) : path.resolve(cwd, '.'),
    }
  } finally {
    rl.close()
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    printUsage()
    return
  }

  const cwd = process.cwd()
  const interactive = process.stdin.isTTY && process.stdout.isTTY && !hasExplicitInputArgs(args)

  if (interactive) {
    const guidedRun = await runInteractiveMode({ args, cwd })
    if (!guidedRun) {
      return
    }

    const {
      preprocessId,
      image,
      workspace,
      preRunConfig,
      message,
      inputRoot,
    } = guidedRun

    const useSingularity = args.singularity === 'true'
    let singularityInfo = null
    if (useSingularity) {
      singularityInfo = await ensureSingularityImage(
        image,
        path.join(cwd, OUTPUT_ROOT_DIR, 'images')
      )
      if (singularityInfo.pulled) {
        console.log(`Pulled singularity image: ${singularityInfo.imagePath}`)
      } else {
        console.log(`Using cached singularity image: ${singularityInfo.imagePath}`)
      }
    } else if (!(await dockerReady())) {
      throw new Error('Docker is not available. Please install/start Docker and try again.')
    }

    const hostPort = randomPort()
    const containerPort = useSingularity ? hostPort : FIXED_CONTAINER_PORT
    const timeoutMs = FIXED_TIMEOUT_MS

    const data = message.data

    const inputMountRoot = path.join(workspace, 'input')
    const outputMountRoot = path.join(workspace, 'output')
    await Promise.all([ensureDir(workspace), ensureDir(inputMountRoot), ensureDir(outputMountRoot)])
    const preRunCopyPath = await writePreRunCopy(workspace, preRunConfig)

    const runInputDir = inputMountRoot
    const runOutputDir = outputMountRoot
    await Promise.all([removeDir(runInputDir), removeDir(runOutputDir)])
    await Promise.all([ensureDir(runInputDir), ensureDir(runOutputDir)])

    console.log('Preparing input files...')
    const staging = await stageCovariateFiles(data.input, inputRoot, runInputDir, args['hard-links'] === 'true')
    console.log(`Staged ${staging.files.length} covariate file(s).`)
    console.log(`Starting ${useSingularity ? 'singularity' : 'docker'} container ${image}...`)

    const containerName = `nfpreprocessor-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
    const container = useSingularity
      ? spawnSingularityRun({
        singularityBinary: singularityInfo.singularityBinary,
        imagePath: singularityInfo.imagePath,
        hostPort,
        mountRoot: workspace,
        alternateDataMountRoot: staging.useAlternateDataMount ? inputRoot : null,
      })
      : spawnDockerRun({
        image,
        containerName,
        hostPort,
        containerPort,
        mountRoot: workspace,
        alternateDataMountRoot: staging.useAlternateDataMount ? inputRoot : null,
      })
    const stopStatsDisplay = useSingularity ? () => {} : startStatsDisplay(containerName)

    let response
    let socket
    try {
      socket = await waitForWebSocket(`ws://127.0.0.1:${hostPort}`, Math.min(timeoutMs, 120000))
      response = await runMessage(socket, message, timeoutMs)
    } finally {
      stopStatsDisplay()
      try {
        socket?.close()
      } catch {}
      if (!useSingularity) {
        await stopContainer(containerName)
      }
      container.kill('SIGTERM')
    }

    const responsePath = path.join(runOutputDir, 'runner-response.json')
    await fs.writeFile(responsePath, `${JSON.stringify(response, null, 2)}\n`)

    console.log('---')
    console.log('Run complete.')
    console.log(`Preprocessor: ${preprocessId}`)
    console.log(`Runtime: ${useSingularity ? 'singularity' : 'docker'}`)
    console.log(`Image: ${image}`)
    console.log(`Workspace: ${workspace}`)
    console.log(`Output directory: ${runOutputDir}`)
    console.log(`Pre-run copy: ${preRunCopyPath}`)
    console.log(`Runner response: ${responsePath}`)
    console.log(`Result type: ${response.type}`)
    if (response.type === 'stdout') {
      console.log(JSON.stringify(response.data, null, 2))
    } else {
      process.stderr.write(`${JSON.stringify(response, null, 2)}\n`)
      process.exitCode = 1
    }
    return
  }

  const preprocessId = FIXED_PREPROCESS_ID
  const preprocess = PREPROCESSORS[preprocessId]
  if (!preprocess) {
    throw new Error(`Unknown preprocess "${preprocessId}".`)
  }
  const compspecPath = preprocess.compspecPath
  const compspec = await readJson(compspecPath)

  if (!args['pre-run'] && !args['covariates-csv']) {
    throw new Error('Provide one input source: --pre-run or --covariates-csv.')
  }

  const image = compspec?.computation?.dockerImage || preprocess.image
  const workspace = path.resolve(cwd, args.workspace || path.join(OUTPUT_ROOT_DIR, outputRunDirectoryName(preprocessId)))
  let inputRoot = path.resolve(cwd, '.')
  const mode = FIXED_MODE
  const iteration = FIXED_ITERATION
  const hostPort = randomPort()
  const timeoutMs = FIXED_TIMEOUT_MS

  let message
  let preRunConfig
  if (args['pre-run']) {
    const preRunPath = path.resolve(cwd, args['pre-run'])
    preRunConfig = await readJson(preRunPath)
    const inputData = await buildInputFromPreRunFile(preRunPath)
    message = buildMessage({
      inputData,
      clientId: FIXED_CLIENT_ID,
      iteration,
      mode,
    })
  } else if (args['covariates-csv']) {
    const covariatesCsvPath = path.resolve(cwd, args['covariates-csv'])
    const covariatesFromCsv = await parseCovariatesCsv(covariatesCsvPath)
    inputRoot = path.dirname(covariatesCsvPath)
    const defaultInput = buildDefaultInputFromCompspec(compspec)
    const inputData = {
      ...defaultInput,
      covariates: covariatesFromCsv,
    }
    preRunConfig = {
      schemaVersion: 1,
      preprocessId,
      createdAt: new Date().toISOString(),
      sources: {
        covariatesCsv: covariatesCsvPath,
        inputRoot,
      },
      input: inputData,
    }
    message = buildMessage({
      inputData,
      clientId: FIXED_CLIENT_ID,
      iteration,
      mode,
    })
  }

  if (args['dry-run'] === 'true') {
    console.log(JSON.stringify(message, null, 2))
    return
  }

  const useSingularity = args.singularity === 'true'
  const containerPort = useSingularity ? hostPort : FIXED_CONTAINER_PORT
  let singularityInfo = null
  if (useSingularity) {
    singularityInfo = await ensureSingularityImage(
      image,
      path.join(cwd, OUTPUT_ROOT_DIR, 'images')
    )
    if (singularityInfo.pulled) {
      console.log(`Pulled singularity image: ${singularityInfo.imagePath}`)
    } else {
      console.log(`Using cached singularity image: ${singularityInfo.imagePath}`)
    }
  } else if (!(await dockerReady())) {
    throw new Error('Docker is not available. Please install/start Docker and try again.')
  }

  const data = message.data
  const inputMountRoot = path.join(workspace, 'input')
  const outputMountRoot = path.join(workspace, 'output')
  await Promise.all([ensureDir(workspace), ensureDir(inputMountRoot), ensureDir(outputMountRoot)])
  const preRunCopyPath = await writePreRunCopy(workspace, preRunConfig)

  const runInputDir = inputMountRoot
  const runOutputDir = outputMountRoot
  await Promise.all([removeDir(runInputDir), removeDir(runOutputDir)])
  await Promise.all([ensureDir(runInputDir), ensureDir(runOutputDir)])

  console.log('Preparing input files...')
  const staging = await stageCovariateFiles(data.input, inputRoot, runInputDir, args['hard-links'] === 'true')
  console.log(`Staged ${staging.files.length} covariate file(s).`)
  console.log(`Starting ${useSingularity ? 'singularity' : 'docker'} container ${image}...`)

  const containerName = `nfpreprocessor-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
  const container = useSingularity
    ? spawnSingularityRun({
      singularityBinary: singularityInfo.singularityBinary,
      imagePath: singularityInfo.imagePath,
      hostPort,
      mountRoot: workspace,
      alternateDataMountRoot: staging.useAlternateDataMount ? inputRoot : null,
    })
    : spawnDockerRun({
      image,
      containerName,
      hostPort,
      containerPort,
      mountRoot: workspace,
      alternateDataMountRoot: staging.useAlternateDataMount ? inputRoot : null,
    })
  const stopStatsDisplay = useSingularity ? () => {} : startStatsDisplay(containerName)

  let response
  let socket
  try {
    socket = await waitForWebSocket(`ws://127.0.0.1:${hostPort}`, Math.min(timeoutMs, 120000))
    response = await runMessage(socket, message, timeoutMs)
  } finally {
    stopStatsDisplay()
    try {
      socket?.close()
    } catch {}
    if (!useSingularity) {
      await stopContainer(containerName)
    }
    container.kill('SIGTERM')
  }

  const responsePath = path.join(runOutputDir, 'runner-response.json')
  await fs.writeFile(responsePath, `${JSON.stringify(response, null, 2)}\n`)

  console.log('---')
  console.log('Run complete.')
  console.log(`Preprocessor: ${preprocessId}`)
  console.log(`Runtime: ${useSingularity ? 'singularity' : 'docker'}`)
  console.log(`Image: ${image}`)
  console.log(`Workspace: ${workspace}`)
  console.log(`Output directory: ${runOutputDir}`)
  console.log(`Pre-run copy: ${preRunCopyPath}`)
  console.log(`Runner response: ${responsePath}`)
  console.log(`Result type: ${response.type}`)
  if (response.type === 'stdout') {
    console.log(JSON.stringify(response.data, null, 2))
  } else {
    process.stderr.write(`${JSON.stringify(response, null, 2)}\n`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`)
  process.exit(1)
})
