// centralFederatedClient/src/runCoordinator/report/reportRunMeta.ts
import { ACCESS_TOKEN, HTTP_URL } from '../../config.js'
import { logger } from '../../logger.js'
import fetch from 'node-fetch'

type GraphQLErrorItem = { message?: string }
type GraphQLResponse<T> = { data?: T; errors?: GraphQLErrorItem[] }

const REPORT_RUN_META_MUTATION = `
  mutation reportRunMeta($runId: String!, $meta: JSON!) {
    reportRunMeta(runId: $runId, meta: $meta)
  }
`

export default async function reportRunMeta(
  { runId, meta }: { runId: string; meta: any }
): Promise<boolean> {
  if (!HTTP_URL) {
    logger.error('reportRunMeta: httpUrl missing from config')
    throw new Error('Config missing httpUrl')
  }

  try {
    const res = await fetch(HTTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: REPORT_RUN_META_MUTATION,
        variables: { runId, meta },
      }),
    })

    // Read raw text for robust error logging, then try to parse JSON
    const text = await res.text()
    let json: GraphQLResponse<{ reportRunMeta: boolean }> | undefined
    try {
      json = text ? (JSON.parse(text) as GraphQLResponse<{ reportRunMeta: boolean }>) : undefined
    } catch {
      // Non-JSON response (e.g., HTML error page)
      json = undefined
    }

    if (!res.ok) {
      logger.error('reportRunMeta: HTTP error', {
        status: res.status,
        statusText: res.statusText,
        body: text.slice(0, 1000), // cap log size
      })
      throw new Error(`HTTP ${res.status}: ${res.statusText || 'Bad Request'}`)
    }

    if (json?.errors?.length) {
      logger.error('reportRunMeta: GraphQL errors', { errors: json.errors })
      const firstMsg = json.errors[0]?.message || 'Unknown GraphQL error'
      throw new Error(firstMsg)
    }

    if (!json?.data || typeof json.data.reportRunMeta !== 'boolean') {
      logger.error('reportRunMeta: Invalid GraphQL response shape', { body: text.slice(0, 1000) })
      throw new Error('Invalid GraphQL response for reportRunMeta')
    }

    return json.data.reportRunMeta
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('reportRunMeta: failed', { runId, error: message })
    throw err
  }
}
