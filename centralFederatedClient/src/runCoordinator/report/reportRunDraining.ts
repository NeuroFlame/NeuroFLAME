// centralFederatedClient/src/runCoordinator/report/reportRunDraining.ts
import { ACCESS_TOKEN, HTTP_URL } from '../../config.js'
import { logger } from '../../logger.js'
import fetch from 'node-fetch'

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

type ReportRunDrainingResponse = {
  reportRunDraining: boolean
}

const REPORT_RUN_DRAINING_MUTATION = `
  mutation reportRunDraining($runId: String!, $meta: JSON) {
    reportRunDraining(runId: $runId, meta: $meta)
  }
`

export default async function reportRunDraining({
  runId,
  meta,
}: {
  runId: string
  meta?: Record<string, unknown>
}) {
  try {
    const response = await fetch(HTTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: REPORT_RUN_DRAINING_MUTATION,
        variables: { runId, meta },
      }),
    })

    const responseData = (await response.json()) as GraphQLResponse<ReportRunDrainingResponse>

    if (responseData.errors) {
      logger.error('GraphQL Error (reportRunDraining):', { error: responseData.errors })
      throw new Error('Failed to report run draining due to GraphQL error')
    }

    if (responseData.data && typeof responseData.data.reportRunDraining === 'boolean') {
      return responseData.data.reportRunDraining
    } else {
      throw new Error('Invalid response data for reportRunDraining')
    }
  } catch (error) {
    logger.error('Error reporting run draining', { error })
    throw error
  }
}
