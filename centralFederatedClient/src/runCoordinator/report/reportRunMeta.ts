import { ACCESS_TOKEN, HTTP_URL } from '../../config.js'
import { logger } from '../../logger.js'
import fetch from 'node-fetch'

type GraphQLErrorItem = { message?: string }
type GraphQLResponse<T> = { data?: T; errors?: GraphQLErrorItem[] }

const REPORT_RUN_META_MUTATION = `
  mutation reportRunMeta($runId: String!, $meta: JSON) {
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

    // Parse JSON safely from unknown
    const jsonRaw: unknown = await res.json()
    const json = jsonRaw as GraphQLResponse<{ reportRunMeta: boolean }>

    if (!res.ok) {
      logger.error('reportRunMeta: HTTP error', { status: res.status, statusText: res.statusText, json })
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    if (Array.isArray(json.errors) && json.errors.length > 0) {
      logger.error('reportRunMeta: GraphQL errors', { errors: json.errors })
      const firstMsg = json.errors[0]?.message || 'Unknown GraphQL error'
      throw new Error(firstMsg)
    }

    if (!json.data || typeof json.data.reportRunMeta !== 'boolean') {
      logger.error('reportRunMeta: Invalid GraphQL response shape', { json })
      throw new Error('Invalid GraphQL response for reportRunMeta')
    }

    return json.data.reportRunMeta
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('reportRunMeta: failed', { runId, error: message })
    throw err
  }
}
