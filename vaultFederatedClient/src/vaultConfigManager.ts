import { promises as fs } from 'fs'
import path from 'path'
import {
  VAULT_ACCESS_TOKEN,
  VAULT_DATASET_DIR,
  VAULT_HTTP_URL,
} from './config.js'
import { logger } from './logger.js'

const GET_MY_VAULT_CONFIG_QUERY = `
  query getMyVaultServerConfig {
    getMyVaultServerConfig {
      id
      name
      description
      vaults {
        id
        name
        description
        datasetKey
        active
        allowedComputations {
          id
          title
          imageName
        }
      }
    }
  }
`

export interface VaultComputationConfig {
  id: string
  title: string
  imageName: string
}

export interface VaultDatasetMapping {
  computationId: string
  datasetKey: string
}

export interface HostedVaultConfig {
  id: string
  name: string
  description: string
  datasetKey: string
  active: boolean
  allowedComputations: VaultComputationConfig[]
}

export interface AvailableVaultDataset {
  key: string
  path: string
  label?: string
}

export interface VaultConfig {
  serverId: string
  serverName: string
  serverDescription: string
  vaults: HostedVaultConfig[]
}

let cachedVaultConfig: VaultConfig = {
  serverId: '',
  serverName: '',
  serverDescription: '',
  vaults: [],
}

function normalizeVaultConfig(rawConfig: {
  id?: string | null
  name?: string | null
  description?: string | null
  vaults?: Array<{
    id?: string | null
    name?: string | null
    description?: string | null
    datasetKey?: string | null
    active?: boolean | null
    allowedComputations?: Array<{
      id?: string | null
      title?: string | null
      imageName?: string | null
    }> | null
  }> | null
} | null | undefined): VaultConfig {
  const vaults = (rawConfig?.vaults ?? [])
    .filter(
      (vault): vault is {
        id: string
        name: string
        description: string
        datasetKey: string
        active?: boolean | null
        allowedComputations?: Array<{
          id?: string | null
          title?: string | null
          imageName?: string | null
        }> | null
      } => Boolean(
        vault?.id &&
        vault.name &&
        vault.description !== undefined &&
        vault.datasetKey,
      ),
    )
    .map((vault) => ({
      id: vault.id.trim(),
      name: vault.name.trim(),
      description: vault.description.trim(),
      datasetKey: vault.datasetKey.trim(),
      active: vault.active !== false,
      allowedComputations: (vault.allowedComputations ?? [])
        .filter(
          (computation): computation is {
            id: string
            title: string
            imageName: string
          } => Boolean(
            computation?.id &&
            computation.title &&
            computation.imageName,
          ),
        )
        .map((computation) => ({
          id: computation.id.trim(),
          title: computation.title.trim(),
          imageName: computation.imageName.trim(),
        })),
    }))

  return {
    serverId: rawConfig?.id?.trim?.() ?? '',
    serverName: rawConfig?.name?.trim?.() ?? '',
    serverDescription: rawConfig?.description?.trim?.() ?? '',
    vaults,
  }
}

export function getAllowedComputationsFromVaultConfig(
  vaultConfig: VaultConfig,
): VaultComputationConfig[] {
  return vaultConfig.vaults
    .filter((vault) => vault.active)
    .flatMap((vault) => vault.allowedComputations)
}

export function getHostedVaultConfig(
  vaultConfig: VaultConfig,
  vaultId: string,
): HostedVaultConfig {
  const hostedVault = vaultConfig.vaults.find((vault) => vault.id === vaultId)
  if (!hostedVault) {
    throw new Error(`Hosted vault ${vaultId} is not configured on this server`)
  }

  if (!hostedVault.active) {
    throw new Error(`Hosted vault ${hostedVault.name} is inactive`)
  }

  return hostedVault
}

export async function fetchVaultConfig(): Promise<VaultConfig> {
  const response = await fetch(VAULT_HTTP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': VAULT_ACCESS_TOKEN,
    },
    body: JSON.stringify({
      query: GET_MY_VAULT_CONFIG_QUERY,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const result = (await response.json()) as {
    data?: {
      getMyVaultServerConfig?: {
        id?: string | null
        name?: string | null
        description?: string | null
        vaults?: Array<{
          id?: string | null
          name?: string | null
          description?: string | null
          datasetKey?: string | null
          active?: boolean | null
          allowedComputations?: Array<{
            id?: string | null
            title?: string | null
            imageName?: string | null
          }>
        }>
      }
    }
    errors?: Array<{ message: string }>
  }

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join(', '))
  }

  cachedVaultConfig = normalizeVaultConfig(result.data?.getMyVaultServerConfig)
  return cachedVaultConfig
}

export async function getVaultConfig(): Promise<VaultConfig> {
  try {
    return await fetchVaultConfig()
  } catch (error) {
    if (cachedVaultConfig.vaults.length > 0) {
      logger.warn('Falling back to cached vault config', { error })
      return cachedVaultConfig
    }

    throw error
  }
}

export async function scanAvailableDatasets(): Promise<AvailableVaultDataset[]> {
  const entries = await fs.readdir(VAULT_DATASET_DIR, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      key: entry.name,
      path: path.join(VAULT_DATASET_DIR, entry.name),
    }))
    .sort((left, right) => left.key.localeCompare(right.key))
}

export async function resolveDatasetPathForVault(
  vaultId: string,
  computationId: string,
): Promise<string> {
  const vaultConfig = await getVaultConfig()
  const hostedVault = getHostedVaultConfig(vaultConfig, vaultId)
  const isAllowed = hostedVault.allowedComputations.some(
    (computation) => computation.id === computationId,
  )

  if (!isAllowed) {
    throw new Error(`Computation ${computationId} is not allowed for hosted vault ${vaultId}`)
  }

  const datasets = await scanAvailableDatasets()
  const dataset = datasets.find((candidate) => candidate.key === hostedVault.datasetKey)
  if (!dataset) {
    throw new Error(
      `Dataset "${hostedVault.datasetKey}" for hosted vault "${hostedVault.name}" is not currently available on this server`,
    )
  }

  return dataset.path
}
