import { getConfig } from '../../config/config.js'
import { logger } from '../../logger.js'
import inMemoryStore from '../../inMemoryStore.js'

// TypeScript interfaces for the GraphQL response
interface GraphQLError {
  message: string
  locations?: { line: number; column: number }[]
  path?: (string | number)[]
  [key: string]: any
}

interface GraphQLResponse<T> {
  data?: T
  errors?: GraphQLError[]
}

interface ReportRunErrorResponse {
  reportRunError: boolean
}

// GraphQL mutation
const REPORT_RUN_ERROR_MUTATION = `
  mutation reportRunError($runId: String!, $errorMessage: String!, $redactErrorDetails: Boolean!) {
    reportRunError(runId: $runId, errorMessage: $errorMessage, redactErrorDetails: $redactErrorDetails)
  }
`

/**
 * This is the only place this process uses its own long-held accessToken
 * (set once at connectAsUser time, never refreshed) for an outbound call
 * of its own — a *successful* run is reported by the coordinator, not
 * this process; onContainerExitSuccess in runStart.ts only logs. This
 * function only runs when a container fails locally and this client
 * tries to tell centralApi about it.
 *
 * A missing token, or centralApi rejecting it as unauthorized, means
 * this process's own session is broken — not a transient network
 * problem, which is handled separately below and does NOT hit this path.
 * Continuing to run in that state is worse than it looks: every future
 * container failure on this site would silently fail to get reported
 * too, the exact same "everything downstream looks fine, nothing was
 * actually recorded" shape as a participant quietly dropping out of a
 * run's aggregation. Failing loudly and exiting turns that into an
 * immediately visible, restart-and-reconnect situation instead — under
 * systemd or `neuroflame edge start`, that means the next `edge
 * connect`/`edge start` picks up a fresh token rather than this process
 * quietly limping along, unable to ever report a failure again.
 */
function exitOnStaleSession(reason: string): never {
  logger.error(`[reportRunError] Session appears stale — exiting: ${reason}`)
  process.exit(1)
}

export default async function reportRunError({
  runId,
  errorMessage,
}: {
  runId: string
  errorMessage: string
}) {
  logger.info(`[reportRunError] Called with runId: ${runId}, errorMessage: ${errorMessage}`)
  try {
    const config = await getConfig()
    const { httpUrl } = config
    logger.info(`[reportRunError] Using httpUrl: ${httpUrl}`)
    const accessToken = inMemoryStore.get('accessToken')
    logger.info(`[reportRunError] Access token exists: ${!!accessToken}`)

    if (!accessToken) {
      exitOnStaleSession(
        'No access token found — connectAsUser was never called on this ' +
          'process, or its in-memory session was cleared.',
      )
    }

    logger.info(`[reportRunError] Sending GraphQL mutation to ${httpUrl}`)
    logger.info(`[reportRunError] Mutation variables: runId=${runId}, errorMessage=${errorMessage}`)
    const response = await fetch(httpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': accessToken,
      },
      body: JSON.stringify({
        query: REPORT_RUN_ERROR_MUTATION,
        variables: { runId, errorMessage, redactErrorDetails: true },
      }),
    })
    logger.info(`[reportRunError] Received response status: ${response.status} ${response.statusText}`)

    // 401/403 specifically means centralApi rejected the stored token
    // itself — this process's session, not a one-off request problem.
    // Any other non-OK status (500, a network blip surfacing as a bad
    // response, etc.) falls through to the generic handling below
    // instead: those don't indicate this session is broken, just that
    // this one report attempt failed.
    if (response.status === 401 || response.status === 403) {
      const responseText = await response.text()
      exitOnStaleSession(
        'centralApi rejected the access token stored by this process ' +
          `(HTTP ${response.status}) while reporting a run error: ${responseText}`,
      )
    }

    // Check for non-OK HTTP status
    if (!response.ok) {
      const responseText = await response.text()
      logger.error(
        `HTTP Error: ${response.status} - ${response.statusText}. Response Body: ${responseText}`,
      )
      throw new Error(
        `Failed to report run error: HTTP ${response.status} - ${response.statusText}`,
      )
    }

    // Parse the JSON response and assert its type
    const responseData = (await response.json()) as GraphQLResponse<
      ReportRunErrorResponse
    >

    // Handle GraphQL errors
    if (responseData.errors && responseData.errors.length > 0) {
      logger.error(
        `GraphQL Errors: ${JSON.stringify(responseData.errors, null, 2)}`,
      )
      throw new Error('Failed to report run error due to GraphQL errors.')
    }

    // Verify the operation's success
    if (responseData.data?.reportRunError !== true) {
      logger.error(
        `reportRunError operation failed. Response Data: ${JSON.stringify(
          responseData.data,
          null,
          2,
        )}`,
      )
      throw new Error('reportRunError operation did not return success.')
    }

    logger.info(`Successfully reported run error for runId: ${runId}`)
    return true
  } catch (error) {
    logger.error(
      `Error in reportRunError: ${
        error instanceof Error ? error.message : JSON.stringify(error)
      }`,
    )
    throw error
  }
}
