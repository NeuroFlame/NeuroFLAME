// Commands against the LOCAL edge federated client — the CLI equivalent of
// the desktop app's "Data Directory" panel on a consortium's page. This is
// a different server than centralApi: it's whichever machine is actually
// running the edge client (standalone, or embedded in the desktop app), and
// it stores one mount directory + local parameters file per consortium on
// that machine's filesystem. See src/graphql/operations.ts for details.
//
// The access token from `neuroflame login` works here unchanged — the edge
// client validates it by asking centralApi, not by checking a local secret.

import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { gqlRequest, describeNetworkError } from '../graphqlClient.js'
import { resolveEdgeUrl, resolveEdgeRunResultsUrl } from '../config.js'
import { requireSession, usageError, printJsonOrHuman } from './shared.js'
import { parseFlags, positionals } from '../utils/flags.js'
import {
  EDGE_GET_MOUNT_DIR_QUERY,
  EDGE_SET_MOUNT_DIR_MUTATION,
  EDGE_GET_LOCAL_PARAMS_QUERY,
  EDGE_SET_LOCAL_PARAMS_MUTATION,
  EDGE_CONNECT_AS_USER_MUTATION,
} from '../graphql/operations.js'

export async function edgeCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case 'connect':
      return connect(args)
    case 'get-mount-dir':
      return getMountDir(args)
    case 'set-mount-dir':
      return setMountDir(args)
    case 'get-local-params':
      return getLocalParams(args)
    case 'set-local-params':
      return setLocalParams(args)
    case 'list-results':
      return listResults(args)
    case 'download-results':
      return downloadResults(args)
    case 'open-results':
      return openResults(args)
    default:
      usageError(
        'neuroflame edge <connect|get-mount-dir|set-mount-dir|get-local-params|' +
          'set-local-params|list-results|download-results|open-results> ...',
      )
  }
}

/**
 * Establishes the edge client's live subscription to centralApi for this
 * identity (see EDGE_CONNECT_AS_USER_MUTATION). Exported so `login
 * --connect-edge` can call it as a best-effort follow-up to logging in.
 */
export async function connectEdgeClient(
  edgeUrl: string,
  accessToken: string,
): Promise<void> {
  await gqlRequest<{ connectAsUser: string }>(
    edgeUrl,
    EDGE_CONNECT_AS_USER_MUTATION,
    {},
    accessToken,
  )
}

async function connect(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  const session = await requireSession()
  const edgeUrl = await resolveEdgeUrl(flags.url)
  await connectEdgeClient(edgeUrl, session.accessToken)
  console.log(`Connected to edge client at ${edgeUrl} as ${session.username}.`)
  console.log(
    'It will now pick up runs started for consortia this user is an ' +
      'active, ready member of.',
  )
}

async function getMountDir(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  const [consortiumId] = positionals(args)
  if (!consortiumId) {
    usageError('neuroflame edge get-mount-dir <consortiumId> [--url <edgeUrl>] [--json]')
  }
  const session = await requireSession()
  const edgeUrl = await resolveEdgeUrl(flags.url)
  const data = await gqlRequest<{ getMountDir: string | null }>(
    edgeUrl,
    EDGE_GET_MOUNT_DIR_QUERY,
    { consortiumId },
    session.accessToken,
  )
  printJsonOrHuman(
    args.includes('--json'),
    { consortiumId, mountDir: data.getMountDir },
    data.getMountDir ?? '(not set)',
  )
}

async function setMountDir(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  // Join everything after consortiumId as the path, so an unquoted path
  // with spaces (the common case when pasting one from Finder/a file
  // manager) works the same as it would through the GUI's native folder
  // picker, instead of silently truncating at the first space.
  const [consortiumId, ...pathParts] = positionals(args)
  const mountDir = pathParts.join(' ')
  if (!consortiumId || !mountDir) {
    usageError(
      'neuroflame edge set-mount-dir <consortiumId> <path> [--url <edgeUrl>]',
    )
  }
  const session = await requireSession()
  const edgeUrl = await resolveEdgeUrl(flags.url)
  await gqlRequest<{ setMountDir: boolean }>(
    edgeUrl,
    EDGE_SET_MOUNT_DIR_MUTATION,
    { consortiumId, mountDir },
    session.accessToken,
  )
  console.log(`Data directory for consortium ${consortiumId} set to: ${mountDir}`)
  console.log(
    'Note: this only sets the directory. Use `neuroflame consortium set-ready ' +
      `${consortiumId} true\` to flip the Ready toggle, the same as the GUI panel.`,
  )
}

async function getLocalParams(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  const [consortiumId, ...pathParts] = positionals(args)
  const mountDir = pathParts.join(' ')
  if (!consortiumId || !mountDir) {
    usageError(
      'neuroflame edge get-local-params <consortiumId> <mountDir> [--url <edgeUrl>]',
    )
  }
  const session = await requireSession()
  const edgeUrl = await resolveEdgeUrl(flags.url)
  const data = await gqlRequest<{ getLocalParams: string }>(
    edgeUrl,
    EDGE_GET_LOCAL_PARAMS_QUERY,
    { consortiumId, mountDir },
    session.accessToken,
  )
  console.log(data.getLocalParams)
}

async function setLocalParams(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  // Same unquoted-path tolerance as setMountDir: consortiumId is first,
  // params is last (JSON/@file already needs its own quoting to survive a
  // shell, so it's an unambiguous anchor), everything between is the path.
  const parts = positionals(args)
  const consortiumId = parts[0]
  const paramsArg = parts[parts.length - 1]
  const mountDir = parts.slice(1, -1).join(' ')
  if (!consortiumId || !mountDir || !paramsArg || parts.length < 3) {
    usageError(
      'neuroflame edge set-local-params <consortiumId> <mountDir> <paramsJson|@file> [--url <edgeUrl>]',
    )
  }

  const localParams = paramsArg.startsWith('@')
    ? await fs.readFile(paramsArg.slice(1), 'utf8')
    : paramsArg

  try {
    JSON.parse(localParams)
  } catch {
    throw new Error('Local parameters must be valid JSON.')
  }

  const session = await requireSession()
  const edgeUrl = await resolveEdgeUrl(flags.url)
  await gqlRequest<{ setLocalParams: boolean }>(
    edgeUrl,
    EDGE_SET_LOCAL_PARAMS_MUTATION,
    { consortiumId, mountDir, localParams },
    session.accessToken,
  )
  console.log('Local parameters set.')
}

// ---------------------------------------------------------------------------
// Results — a run's output files, written by the edge client under
// <pathBaseDirectory>/<consortiumId>/<runId>[/<participantId>]/results and
// served over a plain REST API (edgeFederatedClient's runResultsRoutes.ts),
// not GraphQL. Those routes carry no auth of their own — requireSession()
// here is just this CLI staying consistent about needing a login, not
// something the server actually checks.

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface RunResultFile {
  name: string
  size: number
  isDirectory: boolean
}

async function fetchOrThrow(url: string): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url)
  } catch (error) {
    // Same treatment as gqlRequest's network-error path (graphqlClient.ts)
    // — Node's fetch collapses every connection failure into a generic
    // "fetch failed", with the actually-useful detail (e.g. "connect
    // ECONNREFUSED") buried in `.cause`.
    throw new Error(
      `Could not reach ${url} (${describeNetworkError(error)}). ` +
        'Is the edge client running there, and pointed at correctly ' +
        '(NEUROFLAME_EDGE_URL or --url)?',
    )
  }
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`)
  }
  return response
}

async function listResults(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  const [consortiumId, runId, participantId] = positionals(args)
  if (!consortiumId || !runId) {
    usageError(
      'neuroflame edge list-results <consortiumId> <runId> [participantId] [--url <edgeUrl>] [--json]',
    )
  }
  await requireSession()

  const resultsBase = await resolveEdgeRunResultsUrl(await resolveEdgeUrl(flags.url))
  const url = [resultsBase, consortiumId, runId, participantId].filter(Boolean).join('/')
  const response = await fetchOrThrow(url)
  const files = (await response.json()) as RunResultFile[]

  if (args.includes('--json')) {
    console.log(JSON.stringify(files, null, 2))
    return
  }
  if (files.length === 0) {
    console.log(
      'No result files yet. If the run just completed, try again in a moment — ' +
        'or pass a participantId if results are scoped per-participant.',
    )
    return
  }
  for (const f of files) {
    console.log(`${f.isDirectory ? 'd' : '-'}  ${formatBytes(f.size).padStart(8)}  ${f.name}`)
  }
  console.log(
    `\nDownload all of it: neuroflame edge download-results ${consortiumId} ${runId}` +
      (participantId ? ` ${participantId}` : ''),
  )
}

async function downloadResults(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  const [consortiumId, runId, participantId] = positionals(args)
  if (!consortiumId || !runId) {
    usageError(
      'neuroflame edge download-results <consortiumId> <runId> [participantId] [--out <file>] [--url <edgeUrl>]',
    )
  }
  await requireSession()

  const resultsBase = await resolveEdgeRunResultsUrl(await resolveEdgeUrl(flags.url))
  const url = [resultsBase, 'zip', consortiumId, runId, participantId].filter(Boolean).join('/')
  const response = await fetchOrThrow(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const outPath = flags.out || `${runId}-results.zip`
  await fs.writeFile(outPath, buffer)
  console.log(`Saved ${formatBytes(buffer.length)} to ${outPath}`)
}

/** `open` on macOS, `start` on Windows, `xdg-open` elsewhere. */
function openUrlInBrowser(url: string): Promise<void> {
  const platform = process.platform
  const opener = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open'
  return new Promise((resolve, reject) => {
    const child = spawn(opener, [url], { stdio: 'ignore', shell: platform === 'win32' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`"${opener}" exited with code ${code}`))
    })
  })
}

async function openResults(args: string[]): Promise<void> {
  const flags = parseFlags(args)
  const [consortiumId, runId, participantId] = positionals(args)
  if (!consortiumId || !runId) {
    usageError(
      'neuroflame edge open-results <consortiumId> <runId> [participantId] [--url <edgeUrl>]',
    )
  }
  await requireSession()

  const resultsBase = await resolveEdgeRunResultsUrl(await resolveEdgeUrl(flags.url))
  const base = [resultsBase, consortiumId, runId, participantId].filter(Boolean).join('/')
  const response = await fetchOrThrow(base)
  const files = (await response.json()) as RunResultFile[]

  // Computation output isn't standardized beyond "some files" — index.html
  // is what the computations we've seen actually produce as a human-facing
  // report, and edgeFederatedClient's serveRunFile specifically rewrites
  // its <head> with a <base> tag to make relative asset references work
  // when served this way, which is a strong signal it's meant to be opened
  // exactly like this rather than read as raw file content.
  const indexFile = files.find((f) => f.name.toLowerCase() === 'index.html')
  if (!indexFile) {
    console.log('No index.html report found in this run\'s results. Files present:')
    for (const f of files) console.log(`  ${f.name}`)
    console.log(
      `\nDownload and inspect them directly: neuroflame edge download-results ${consortiumId} ${runId}` +
        (participantId ? ` ${participantId}` : ''),
    )
    return
  }

  const target = `${base}/index.html`
  console.log(`Opening ${target}`)
  try {
    await openUrlInBrowser(target)
  } catch (error) {
    console.log(
      `Could not open a browser automatically (${error instanceof Error ? error.message : error}). ` +
        `Open this URL yourself: ${target}`,
    )
  }
}
