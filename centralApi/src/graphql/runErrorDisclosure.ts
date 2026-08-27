const REDACTED_PARTICIPANT_ERROR =
  'Site computation failed. Detailed error is available only to that participant.'
const REDACTED_HOSTED_VAULT_ERROR =
  'Hosted vault computation failed. Detailed error was not disclosed by vault policy.'

export const MAX_DISCLOSED_RUN_ERROR_BYTES = 64 * 1024

export type RunErrorReporter = 'central' | 'hostedVault' | 'participant'

export const shouldRedactRunError = ({
  reporter,
  requestedRedaction,
}: {
  reporter: RunErrorReporter
  requestedRedaction: boolean
}): boolean => {
  if (reporter === 'central') {
    return false
  }
  if (reporter === 'hostedVault') {
    return requestedRedaction
  }
  return true
}

export const disclosedRunErrorMessage = ({
  errorMessage,
  reporter,
  requestedRedaction,
}: {
  errorMessage: string
  reporter: RunErrorReporter
  requestedRedaction: boolean
}): string => {
  if (shouldRedactRunError({ reporter, requestedRedaction })) {
    return reporter === 'hostedVault'
      ? REDACTED_HOSTED_VAULT_ERROR
      : REDACTED_PARTICIPANT_ERROR
  }

  if (Buffer.byteLength(errorMessage, 'utf8') > MAX_DISCLOSED_RUN_ERROR_BYTES) {
    throw new Error(
      `Detailed run error exceeds ${MAX_DISCLOSED_RUN_ERROR_BYTES} bytes`,
    )
  }
  return errorMessage
}
