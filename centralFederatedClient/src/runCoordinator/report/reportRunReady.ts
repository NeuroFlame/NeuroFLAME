import getConfig from '../../config/getConfig.js'
import { logger } from '../../logger.js'
import fetch from 'node-fetch' // Import node-fetch

// TypeScript interfaces for the GraphQL response
interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

interface ReportRunReadyResponse {
  reportRunReady: {
    success: boolean
    message?: string
  }
}

// GraphQL mutation
const REPORT_RUN_READY_MUTATION = `
  mutation reportRunReady($runId: String!) {
    reportRunReady(runId: $runId)
  }
`

export default async function reportReady({ runId }: { runId: string }) {
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
        query: REPORT_RUN_READY_MUTATION,
        variables: { runId },
      }),
    })

    // Parse the JSON response and assert its type
    const responseData = (await response.json()) as GraphQLResponse<
      ReportRunReadyResponse
    >

    // Handle the response data here
    if (responseData.errors) {
      logger.error('GraphQL Error:', { error: responseData.errors })
      throw new Error('Failed to report run ready due to GraphQL error')
    }

    if (responseData.data && responseData.data.reportRunReady) {
      return responseData.data.reportRunReady
    } else {
      throw new Error('Invalid response data')
    }
  } catch (error) {
    logger.error('Error reporting run ready', { error })
    throw error
  }
}
