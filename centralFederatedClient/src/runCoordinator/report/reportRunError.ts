import getConfig from '../../config/getConfig.js'
import { logger } from '../../logger.js'
import fetch from 'node-fetch' // Import node-fetch

// TypeScript interfaces for the GraphQL response
interface GraphQLResponse<T> {
  data?: T
  errors?: { errorMessage: string }[]
}

interface ReportRunErrorResponse {
  reportRunError: {
    success: boolean
    errorMessage?: string
  }
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
  const config = await getConfig()
  const { httpUrl, accessToken } = config

  try {
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

    // Parse the JSON response and assert its type
    const responseData = (await response.json()) as GraphQLResponse<
      ReportRunErrorResponse
    >

    // Handle the response data here
    if (responseData.errors) {
      logger.error(`GraphQL Error`, { error: responseData.errors })
      throw new Error('Failed to report run error due to GraphQL error')
    }

    if (responseData.data && responseData.data.reportRunError) {
      return responseData.data.reportRunError
    } else {
      throw new Error('Invalid response data')
    }
  } catch (error) {
    logger.error(`Error reporting run error`, { error })
    throw error
  }
}
