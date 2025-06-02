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
  mutation reportRunError($runId: String!, $errorMessage: String!) {
    reportRunError(runId: $runId, errorMessage: $errorMessage)
  }
`

export default async function reportRunError({
  runId,
  errorMessage,
}: {
  runId: string
  errorMessage: string
}) {
  try {
    const config = await getConfig()
    const { httpUrl } = config
    const accessToken = inMemoryStore.get('accessToken')

    if (!accessToken) {
      logger.error('No access token found. Aborting reportRunError operation.')
      throw new Error('Access token is missing.')
    }

    const response = await fetch(httpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': accessToken,
      },
      body: JSON.stringify({
        query: REPORT_RUN_ERROR_MUTATION,
        variables: { runId, errorMessage },
      }),
    })

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
