import { Session, requireSession } from '../session.js'
import { gqlRequest, subscribeToCentral } from '../graphqlClient.js'
import { terminalStatusHint } from './shared.js'

const RUN_DETAILS_QUERY = `
  query runDetails($runId: String!) {
    getRunDetails(runId: $runId) {
      status
      lastUpdated
      consortium { id }
    }
  }
`

// centralApi has no enum for this — statuses observed in centralApi's
// resolvers are: Provisioning, Starting, In Progress, Complete, Error.
const RUN_EVENT_SUBSCRIPTION = `
  subscription {
    runEvent {
      runId
      status
      consortiumTitle
      timestamp
    }
  }
`

const TERMINAL_STATUSES = new Set(['Complete', 'Error'])

interface RunDetailsData {
  getRunDetails: {
    status: string
    lastUpdated: string
    consortium: { id: string }
  }
}

interface RunEvent {
  runId: string
  status: string
  consortiumTitle: string
  timestamp: string
}

/**
 * Prints the current status of a run, then streams status changes until it
 * reaches a terminal state (Complete/Error). Sets process.exitCode
 * accordingly (0 for Complete, 1 for Error) so this is usable as the last
 * step of a batch script.
 */
export async function watchRun(
  session: Session,
  runId: string,
  json: boolean,
): Promise<void> {
  const print = (status: string, timestamp: string): void => {
    if (json) {
      console.log(JSON.stringify({ runId, status, timestamp }))
    } else {
      console.log(`[${timestamp}] ${status}`)
    }
  }

  // Only in human mode — a hint line in --json output would break anyone
  // piping this to `jq`/parsing it as one JSON object per line.
  const printHint = (status: string, consortiumId: string): void => {
    if (json) return
    const hint = terminalStatusHint(status, consortiumId, runId)
    if (hint) console.log(hint)
  }

  const initial = await gqlRequest<RunDetailsData>(
    session.httpUrl,
    RUN_DETAILS_QUERY,
    { runId },
    session.accessToken,
  )
  const consortiumId = initial.getRunDetails.consortium.id

  print(initial.getRunDetails.status, initial.getRunDetails.lastUpdated)

  if (TERMINAL_STATUSES.has(initial.getRunDetails.status)) {
    printHint(initial.getRunDetails.status, consortiumId)
    process.exitCode = initial.getRunDetails.status === 'Error' ? 1 : 0
    return
  }

  await new Promise<void>((resolve) => {
    const unsubscribe = subscribeToCentral<RunEvent>(
      session.wsUrl,
      session.accessToken,
      RUN_EVENT_SUBSCRIPTION,
      (event) => {
        if (event.runId !== runId) return
        print(event.status, event.timestamp)
        if (TERMINAL_STATUSES.has(event.status)) {
          printHint(event.status, consortiumId)
          process.exitCode = event.status === 'Error' ? 1 : 0
          unsubscribe()
          resolve()
        }
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
    )
  })
}

export async function runWatchCommand(args: string[]): Promise<void> {
  const runId = args.find((a) => !a.startsWith('--'))
  if (!runId) {
    console.error('Usage: neuroflame run watch <runId> [--json]')
    process.exitCode = 1
    return
  }
  const session = await requireSession()
  await watchRun(session, runId, args.includes('--json'))
}
