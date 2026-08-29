import { getConfig } from '../../config/config.js'
import { logger } from '../../logger.js'
import inMemoryStore from '../../inMemoryStore.js'
import { onStaleSession } from '../../auth/staleSessionHandler.js'

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
      // This is the only place this process uses its own long-held
      // accessToken (set once at connectAsUser time, never refreshed) for
      // an outbound call of its own — a *successful* run is reported by
      // the coordinator, not this process; onContainerExitSuccess in
      // runStart.ts only logs. A missing token here means this process's
      // own session is broken, not a transient network problem — see
      // staleSessionHandler.ts for what that triggers (exits the process
      // by default; overridable by anything embedding this package
      // in-process, e.g. the desktop app). Explicitly throw afterward
      // regardless of what the handler does — an overridden handler may
      // not terminate execution, and this attempt has still failed.
      onStaleSession(
        'No access token found — connectAsUser was never called on this ' +
          'process, or its in-memory session was cleared.',
      )
      throw new Error('Access token is missing.')
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
      onStaleSession(
        'centralApi rejected the access token stored by this process ' +
          `(HTTP ${response.status}) while reporting a run error: ${responseText}`,
      )
      throw new Error(
        `centralApi rejected the stored access token (HTTP ${response.status}): ${responseText}`,
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
