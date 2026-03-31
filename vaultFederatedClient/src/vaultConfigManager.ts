import { promises as fs } from 'fs'
import path from 'path'
import {
  VAULT_ACCESS_TOKEN,
  VAULT_DATASET_DIR,
  VAULT_HTTP_URL,
} from './config.js'
import { logger } from './logger.js'

const GET_MY_VAULT_CONFIG_QUERY = `
  query getMyVaultConfig {
    getMyVaultConfig {
      allowedComputations {
        id
        title
        imageName
      }
      datasetMappings {
        computationId
        datasetKey
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

export interface AvailableVaultDataset {
  key: string
  path: string
  label?: string
  lastSeenAt: string
}

export interface VaultConfig {
  allowedComputations: VaultComputationConfig[]
  datasetMappings: VaultDatasetMapping[]
}

let cachedVaultConfig: VaultConfig = {
  allowedComputations: [],
  datasetMappings: [],
}

function normalizeVaultConfig(rawConfig: {
  allowedComputations?: Array<{
    id?: string | null
    title?: string | null
    imageName?: string | null
  }> | null
  datasetMappings?: Array<{
    computationId?: string | null
    datasetKey?: string | null
  }> | null
} | null | undefined): VaultConfig {
  const allowedComputations = (rawConfig?.allowedComputations ?? [])
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
    }))

  const datasetMappings = (rawConfig?.datasetMappings ?? [])
    .filter(
      (mapping): mapping is {
        computationId: string
        datasetKey: string
      } => Boolean(
        mapping?.computationId &&
        mapping.datasetKey &&
        mapping.datasetKey.trim().length > 0,
      ),
    )
    .map((mapping) => ({
      computationId: mapping.computationId.trim(),
      datasetKey: mapping.datasetKey.trim(),
    }))

  return {
    allowedComputations,
    datasetMappings,
  }
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
      getMyVaultConfig?: {
        allowedComputations?: Array<{
          id?: string | null
          title?: string | null
          imageName?: string | null
        }>
        datasetMappings?: Array<{
          computationId?: string | null
          datasetKey?: string | null
        }>
      }
    }
    errors?: Array<{ message: string }>
  }

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join(', '))
  }

  cachedVaultConfig = normalizeVaultConfig(result.data?.getMyVaultConfig)
  return cachedVaultConfig
}

export async function getVaultConfig(): Promise<VaultConfig> {
  try {
    return await fetchVaultConfig()
  } catch (error) {
    if (cachedVaultConfig.allowedComputations.length > 0 || cachedVaultConfig.datasetMappings.length > 0) {
      logger.warn('Falling back to cached vault config', { error })
      return cachedVaultConfig
    }

    throw error
  }
}

export async function scanAvailableDatasets(): Promise<AvailableVaultDataset[]> {
  const entries = await fs.readdir(VAULT_DATASET_DIR, { withFileTypes: true })
  const seenAt = new Date().toISOString()

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      key: entry.name,
      path: path.join(VAULT_DATASET_DIR, entry.name),
      lastSeenAt: seenAt,
    }))
    .sort((left, right) => left.key.localeCompare(right.key))
}

export async function resolveDatasetPathForComputation(
  computationId: string,
): Promise<string> {
  const vaultConfig = await getVaultConfig()
  const isAllowed = vaultConfig.allowedComputations.some(
    (computation) => computation.id === computationId,
  )

  if (!isAllowed) {
    throw new Error(`Computation ${computationId} is not allowed for this vault`)
  }

  const mapping = vaultConfig.datasetMappings.find(
    (candidate) => candidate.computationId === computationId,
  )
  if (!mapping) {
    throw new Error(
      `No dataset mapping is configured for computation ${computationId}`,
    )
  }

  const datasets = await scanAvailableDatasets()
  const dataset = datasets.find((candidate) => candidate.key === mapping.datasetKey)
  if (!dataset) {
    throw new Error(
      `Mapped dataset "${mapping.datasetKey}" is not currently available on this vault`,
    )
  }

  return dataset.path
}
