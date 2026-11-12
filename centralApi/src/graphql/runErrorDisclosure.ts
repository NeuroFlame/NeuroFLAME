const REDACTED_PARTICIPANT_ERROR =
  'Site computation failed. Detailed error is available only to that participant.'
const REDACTED_HOSTED_VAULT_ERROR =
  'Hosted vault computation failed. Detailed error was not disclosed by vault policy.'
const OVERSIZED_ERROR: Record<'central' | 'hostedVault', string> = {
  central: 'Central computation failed. The detailed error exceeded the size limit.',
  hostedVault: 'Hosted vault computation failed. The detailed error exceeded the size limit.',
}

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

  // Never persist oversized detail, but still record that the run failed.
  if (Buffer.byteLength(errorMessage, 'utf8') > MAX_DISCLOSED_RUN_ERROR_BYTES) {
    return OVERSIZED_ERROR[reporter === 'central' ? 'central' : 'hostedVault']
  }
  return errorMessage
}
