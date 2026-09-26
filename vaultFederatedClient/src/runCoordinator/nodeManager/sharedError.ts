const SHARED_ERROR_PREFIX = 'NEUROFLAME_SHARED_ERROR:'
const DOCKER_TIMESTAMP_PREFIX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z /

const ERROR_MESSAGES = {
  central_computation_failed: {
    startup: 'Central computation failed during startup',
    execution: 'Central computation failed during execution',
    aggregation: 'Central computation failed during aggregation',
    transfer: 'Central computation failed during artifact transfer',
  },
  participant_computation_failed: {
    startup: 'Participant computation failed during startup',
    execution: 'Participant computation failed during execution',
    aggregation: 'Participant computation failed during aggregation',
    transfer: 'Participant computation failed during artifact transfer',
  },
} as const

type ErrorCode = keyof typeof ERROR_MESSAGES
type ErrorStage = keyof (typeof ERROR_MESSAGES)[ErrorCode]

interface SharedErrorEnvelope {
  schema_version: 1
  origin: 'central' | 'site'
  stage: ErrorStage
  code: ErrorCode
}

const isSharedErrorEnvelope = (value: unknown): value is SharedErrorEnvelope => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (candidate.schema_version !== 1) return false
  if (candidate.origin !== 'central' && candidate.origin !== 'site') return false
  if (
    candidate.code !== 'central_computation_failed' &&
    candidate.code !== 'participant_computation_failed'
  ) return false
  if (
    candidate.stage !== 'startup' &&
    candidate.stage !== 'execution' &&
    candidate.stage !== 'aggregation' &&
    candidate.stage !== 'transfer'
  ) return false
  return (
    (candidate.origin === 'central' && candidate.code === 'central_computation_failed') ||
    (candidate.origin === 'site' && candidate.code === 'participant_computation_failed')
  )
}

export const extractSharedError = (logs: string, fallback: string): string => {
  const encodedLines = logs
    .split(/\r?\n/)
    .map((line) => line.replace(DOCKER_TIMESTAMP_PREFIX, ''))
    .filter((line) => line.startsWith(SHARED_ERROR_PREFIX))
  for (const line of encodedLines) {
    try {
      const envelope: unknown = JSON.parse(line.slice(SHARED_ERROR_PREFIX.length))
      if (isSharedErrorEnvelope(envelope)) {
        return ERROR_MESSAGES[envelope.code][envelope.stage]
      }
    } catch {
      // Ignore malformed computation output and use an orchestrator-owned fallback.
    }
  }
  return fallback
}
