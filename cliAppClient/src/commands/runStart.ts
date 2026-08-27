import { requireSession } from '../session.js'
import { gqlRequest } from '../graphqlClient.js'
import { watchRun } from './runWatch.js'

const START_RUN_MUTATION = `
  mutation startRun($input: StartRunInput!) {
    startRun(input: $input) {
      runId
    }
  }
`

interface StartRunData {
  startRun: {
    runId: string
  }
}

export async function runStartCommand(args: string[]): Promise<void> {
  const consortiumId = args.find((a) => !a.startsWith('--'))
  if (!consortiumId) {
    console.error('Usage: neuroflame run start <consortiumId> [--wait] [--json]')
    process.exitCode = 1
    return
  }

  const json = args.includes('--json')
  const session = await requireSession()

  const data = await gqlRequest<StartRunData>(
    session.httpUrl,
    START_RUN_MUTATION,
    { input: { consortiumId } },
    session.accessToken,
  )
  const { runId } = data.startRun

  if (json) {
    console.log(JSON.stringify({ runId }))
  } else {
    console.log(`Run started: ${runId}`)
  }

  if (args.includes('--wait')) {
    await watchRun(session, runId, json)
  }
}
