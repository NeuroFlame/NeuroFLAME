import { ACCESS_TOKEN, HTTP_URL } from '../../config.js'
import { logger } from '../../logger.js'
import fetch from 'node-fetch' // Import node-fetch
import type { ResolvedComputationImage } from '../nodeManager/launchNode.js'

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
  mutation reportRunReady($runId: String!, $resolvedImage: ResolvedComputationImageInput!) {
    reportRunReady(runId: $runId, resolvedImage: $resolvedImage)
  }
`

export default async function reportReady({
  runId,
  resolvedImage,
}: {
  runId: string
  resolvedImage: ResolvedComputationImage
}) {
  try {
    const response = await fetch(HTTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: REPORT_RUN_READY_MUTATION,
        variables: { runId, resolvedImage },
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
