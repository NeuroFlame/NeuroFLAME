import { gqlRequest, subscribeToCentral } from '../graphqlClient.js'
import { requireSession, usageError, terminalStatusHint } from './shared.js'
import { positionals } from '../utils/flags.js'
import { runStartCommand } from './runStart.js'
import { runWatchCommand } from './runWatch.js'
import {
  GET_RUN_LIST_QUERY,
  GET_RUN_DETAILS_QUERY,
  RUN_DELETE_MUTATION,
  CONSORTIUM_LATEST_RUN_CHANGED_SUBSCRIPTION,
  RunListItem,
  RunDetails,
} from '../graphql/operations.js'

export async function runCommand(
  subcommand: string | undefined,
  args: string[],
): Promise<void> {
  switch (subcommand) {
    case 'start':
      return runStartCommand(args)
    case 'watch':
      return runWatchCommand(args)
    case 'watch-consortium':
      return watchConsortium(args)
    case 'list':
      return list(args)
    case 'show':
      return show(args)
    case 'delete':
      return remove(args)
    default:
      usageError('neuroflame run <start|list|show|watch|watch-consortium|delete> ...')
  }
}

async function fetchRunList(
  httpUrl: string,
  accessToken: string,
  consortiumId: string | null,
): Promise<RunListItem[]> {
  const data = await gqlRequest<{ getRunList: RunListItem[] }>(
    httpUrl,
    GET_RUN_LIST_QUERY,
    { consortiumId },
    accessToken,
  )
  return data.getRunList
}

// getRunList (centralApi's resolvers.ts) is sorted createdAt: -1 — newest
// first — so "the latest run" is just list[0]. No separate query needed.
function printRunList(list: RunListItem[], json: boolean, latestOnly: boolean): void {
  const items = latestOnly ? list.slice(0, 1) : list

  if (json) {
    console.log(JSON.stringify(latestOnly ? items[0] ?? null : items, null, 2))
    return
  }
  if (items.length === 0) {
    console.log('No runs found.')
    return
  }
  for (const r of items) {
    console.log(`${r.runId}  ${r.status}  ${r.consortiumTitle}  (updated ${r.lastUpdated})`)
    const hint = terminalStatusHint(r.status, r.consortiumId, r.runId)
    if (hint) console.log(hint)
  }
}

async function list(args: string[]): Promise<void> {
  const [consortiumId] = positionals(args)
  const session = await requireSession()
  const list = await fetchRunList(session.httpUrl, session.accessToken, consortiumId ?? null)
  printRunList(list, args.includes('--json'), args.includes('--latest'))
}

async function watchConsortium(args: string[]): Promise<void> {
  const [consortiumId] = positionals(args)
  if (!consortiumId) {
    usageError('neuroflame run watch-consortium <consortiumId> [--latest] [--json]')
  }
  const json = args.includes('--json')
  const latest = args.includes('--latest')
  const session = await requireSession()

  printRunList(
    await fetchRunList(session.httpUrl, session.accessToken, consortiumId),
    json,
    latest,
  )
  console.error('Watching for run changes. Press Ctrl+C to stop.')

  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      unsubscribe()
      resolve()
    })

    const unsubscribe = subscribeToCentral<string>(
      session.wsUrl,
      session.accessToken,
      CONSORTIUM_LATEST_RUN_CHANGED_SUBSCRIPTION,
      () => {
        fetchRunList(session.httpUrl, session.accessToken, consortiumId)
          .then((list) => printRunList(list, json, latest))
          .catch((error: unknown) => {
            console.error(
              'Failed to refresh run list:',
              error instanceof Error ? error.message : error,
            )
          })
      },
      (error) => {
        console.error(
          'Subscription error:',
          error instanceof Error ? error.message : error,
        )
        process.exitCode = 1
        unsubscribe()
        resolve()
      },
      { consortiumId },
    )
  })
}

async function show(args: string[]): Promise<void> {
  const [runId] = args
  if (!runId) usageError('neuroflame run show <runId> [--json]')
  const session = await requireSession()
  const data = await gqlRequest<{ getRunDetails: RunDetails }>(
    session.httpUrl,
    GET_RUN_DETAILS_QUERY,
    { runId },
    session.accessToken,
  )
  const r = data.getRunDetails

  if (args.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    return
  }

  console.log(`${r.runId}  ${r.status}`)
  console.log(`consortium: ${r.consortium.title}  leader: ${r.consortium.leader.username}`)
  console.log(`created: ${r.createdAt}  updated: ${r.lastUpdated}`)
  console.log(`computation: ${r.studyConfiguration.computation?.title ?? '(unknown)'}`)
  if (r.runErrors.length > 0) {
    console.log('errors:')
    for (const e of r.runErrors) {
      console.log(`  [${e.timestamp}] ${e.user.username}: ${e.message}`)
    }
  } else if (r.status === 'Complete') {
    console.log(`\nresults: neuroflame edge open-results ${r.consortium.id} ${r.runId}`)
  }
}

async function remove(args: string[]): Promise<void> {
  const [runId] = args
  if (!runId) usageError('neuroflame run delete <runId>')
  const session = await requireSession()
  await gqlRequest<{ runDelete: boolean }>(
    session.httpUrl,
    RUN_DELETE_MUTATION,
    { runId },
    session.accessToken,
  )
  console.log('Run deleted.')
}
