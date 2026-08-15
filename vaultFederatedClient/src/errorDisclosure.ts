export type VaultErrorDisclosure = 'redacted' | 'detailed'

export const parseVaultErrorDisclosure = (
  value: string | undefined,
): VaultErrorDisclosure => {
  if (value === undefined || value.trim() === '') {
    return 'redacted'
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'redacted' || normalized === 'detailed') {
    return normalized
  }

  throw new Error(
    `VAULT_ERROR_DISCLOSURE must be redacted or detailed (received ${JSON.stringify(value)})`,
  )
}
