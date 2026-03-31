import Docker from 'dockerode'
import https from 'https'
import { execFile, spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import {
  VAULT_BASE_DIR,
} from './config.js'
import { logger } from './logger.js'
import { getVaultConfig } from './vaultConfigManager.js'

const docker = new Docker()

const IMAGE_REFRESH_INTERVAL_MS = 5 * 60 * 1000
const IMAGE_CACHE_STATE_PATH = path.join(VAULT_BASE_DIR, 'image-cache-state.json')
const SINGULARITY_IMAGES_DIR = path.join(VAULT_BASE_DIR, 'singularityImages')

type ContainerService = 'docker' | 'singularity'
type DockerStatus = 'missing' | 'pulling' | 'ready' | 'failed'
type SingularityStatus = 'missing' | 'pending' | 'running' | 'ready' | 'failed'

interface DockerCacheState {
  localDigest?: string
  status?: DockerStatus
  lastPulledAt?: string
  lastPullAttemptAt?: string
  lastError?: string
}

interface SingularityCacheState {
  currentHash?: string
  status?: SingularityStatus
  lastBuildAttemptAt?: string
  lastBuiltAt?: string
  lastError?: string
}

interface ImageCacheEntry {
  remoteDigest?: string
  lastCheckedAt?: string
  lastSeenAt?: string
  docker: DockerCacheState
  singularity: SingularityCacheState
}

interface ImageCacheState {
  version: 1
  images: Record<string, ImageCacheEntry>
}

interface RegistryAuthChallenge {
  realm: string
  service?: string
  scope?: string
}

interface ParsedImageReference {
  registryHost: string
  repository: string
  reference: string
}

let cacheState: ImageCacheState = {
  version: 1,
  images: {},
}

let refreshInterval: NodeJS.Timeout | null = null
let refreshInFlight: Promise<void> | null = null
let writeStatePromise: Promise<void> = Promise.resolve()
let singularityBuildQueue: Promise<void> = Promise.resolve()
let allowedImageNames: string[] = []

const activeDockerPulls = new Map<string, Promise<string | undefined>>()
const activeSingularityBuilds = new Map<string, Promise<string>>()

function nowIso(): string {
  return new Date().toISOString()
}

function ensureImageEntry(imageName: string): ImageCacheEntry {
  if (!cacheState.images[imageName]) {
    cacheState.images[imageName] = {
      docker: {},
      singularity: {},
    }
  }
  return cacheState.images[imageName]
}

function persistCacheState(): Promise<void> {
  const serializedState = JSON.stringify(cacheState, null, 2)
  writeStatePromise = writeStatePromise
    .then(async () => {
      await fs.mkdir(VAULT_BASE_DIR, { recursive: true })
      await fs.writeFile(IMAGE_CACHE_STATE_PATH, serializedState, 'utf-8')
    })
    .catch((error) => {
      logger.error('Failed to persist image cache state', { error })
    })
  return writeStatePromise
}

async function loadCacheState(): Promise<void> {
  try {
    const raw = await fs.readFile(IMAGE_CACHE_STATE_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ImageCacheState>
    cacheState = {
      version: 1,
      images: parsed.images ?? {},
    }
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== 'ENOENT') {
      logger.warn('Failed to load image cache state, starting with empty state', {
        error,
      })
    }
    cacheState = {
      version: 1,
      images: {},
    }
  }
}

function dockerImageToSingularityPattern(dockerImageName: string): string {
  return dockerImageName
    .replace(/:latest$/, '')
    .replace(/[:@]/g, '_')
    .replace(/\//g, '_')
    .toLowerCase()
}

function digestToShortHash(digest: string): string {
  return digest.replace(/^sha256:/, '').slice(0, 12)
}

function parseImageReference(imageName: string): ParsedImageReference {
  const trimmed = imageName.trim()
  const digestSeparatorIndex = trimmed.indexOf('@')
  const slashIndex = trimmed.lastIndexOf('/')
  const colonIndex = trimmed.lastIndexOf(':')

  let imageWithoutReference = trimmed
  let reference = 'latest'

  if (digestSeparatorIndex >= 0) {
    imageWithoutReference = trimmed.slice(0, digestSeparatorIndex)
    reference = trimmed.slice(digestSeparatorIndex + 1)
  } else if (colonIndex > slashIndex) {
    imageWithoutReference = trimmed.slice(0, colonIndex)
    reference = trimmed.slice(colonIndex + 1)
  }

  const parts = imageWithoutReference.split('/')
  const hasExplicitRegistry =
    parts.length > 1 &&
    (parts[0].includes('.') || parts[0].includes(':') || parts[0] === 'localhost')

  if (hasExplicitRegistry) {
    return {
      registryHost: parts[0],
      repository: parts.slice(1).join('/'),
      reference,
    }
  }

  return {
    registryHost: 'registry-1.docker.io',
    repository:
      parts.length === 1 ? `library/${parts[0]}` : parts.join('/'),
    reference,
  }
}

function parseRegistryAuthChallenge(headerValue: string | undefined): RegistryAuthChallenge | null {
  if (!headerValue) {
    return null
  }

  const match = /^Bearer\s+(.+)$/i.exec(headerValue)
  if (!match) {
    return null
  }

  const attributes = match[1]
  const parsed: Record<string, string> = {}
  const attributePattern = /([a-zA-Z]+)="([^"]+)"/g
  let attributeMatch = attributePattern.exec(attributes)
  while (attributeMatch) {
    parsed[attributeMatch[1]] = attributeMatch[2]
    attributeMatch = attributePattern.exec(attributes)
  }

  if (!parsed.realm) {
    return null
  }

  return {
    realm: parsed.realm,
    service: parsed.service,
    scope: parsed.scope,
  }
}

function httpRequest(
  url: URL,
  {
    method,
    headers,
  }: {
    method: 'GET' | 'HEAD'
    headers?: Record<string, string>
  },
): Promise<{
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: string
}> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
      },
      (response) => {
        let body = ''
        response.on('data', (chunk) => {
          body += chunk.toString()
        })
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body,
          })
        })
      },
    )

    request.on('error', (error) => {
      reject(error)
    })

    request.end()
  })
}

async function getRegistryBearerToken(
  challenge: RegistryAuthChallenge,
): Promise<string | undefined> {
  const tokenUrl = new URL(challenge.realm)
  if (challenge.service) {
    tokenUrl.searchParams.set('service', challenge.service)
  }
  if (challenge.scope) {
    tokenUrl.searchParams.set('scope', challenge.scope)
  }

  const response = await httpRequest(tokenUrl, { method: 'GET' })
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `Registry auth request failed with status ${response.statusCode}`,
    )
  }

  const payload = JSON.parse(response.body) as {
    token?: string
    access_token?: string
  }
  return payload.token ?? payload.access_token
}

async function getRemoteImageDigest(imageName: string): Promise<string | undefined> {
  const parsedReference = parseImageReference(imageName)
  const manifestUrl = new URL(
    `https://${parsedReference.registryHost}/v2/${parsedReference.repository}/manifests/${parsedReference.reference}`,
  )
  const baseHeaders = {
    Accept: [
      'application/vnd.docker.distribution.manifest.v2+json',
      'application/vnd.docker.distribution.manifest.list.v2+json',
      'application/vnd.oci.image.manifest.v1+json',
      'application/vnd.oci.image.index.v1+json',
    ].join(', '),
  }

  const requestDigest = async (
    method: 'GET' | 'HEAD',
    token?: string,
  ): Promise<{
    statusCode: number
    headers: Record<string, string | string[] | undefined>
    body: string
  }> => {
    const headers = token
      ? { ...baseHeaders, Authorization: `Bearer ${token}` }
      : baseHeaders
    return httpRequest(manifestUrl, { method, headers })
  }

  let token: string | undefined
  let response = await requestDigest('HEAD')

  if (response.statusCode === 401) {
    const authHeader = Array.isArray(response.headers['www-authenticate'])
      ? response.headers['www-authenticate'][0]
      : response.headers['www-authenticate']
    const challenge = parseRegistryAuthChallenge(authHeader)
    if (challenge) {
      token = await getRegistryBearerToken(challenge)
      response = await requestDigest('HEAD', token)
    }
  }

  const headerDigest = Array.isArray(response.headers['docker-content-digest'])
    ? response.headers['docker-content-digest'][0]
    : response.headers['docker-content-digest']
  if (
    response.statusCode >= 200 &&
    response.statusCode < 300 &&
    typeof headerDigest === 'string' &&
    headerDigest.startsWith('sha256:')
  ) {
    return headerDigest
  }

  const getResponse = await requestDigest('GET', token)
  const getHeaderDigest = Array.isArray(getResponse.headers['docker-content-digest'])
    ? getResponse.headers['docker-content-digest'][0]
    : getResponse.headers['docker-content-digest']
  if (
    getResponse.statusCode >= 200 &&
    getResponse.statusCode < 300 &&
    typeof getHeaderDigest === 'string' &&
    getHeaderDigest.startsWith('sha256:')
  ) {
    return getHeaderDigest
  }

  if (getResponse.statusCode < 200 || getResponse.statusCode >= 300) {
    throw new Error(
      `Manifest lookup failed with status ${getResponse.statusCode}`,
    )
  }

  const manifest = JSON.parse(getResponse.body) as {
    config?: { digest?: string }
  }
  if (manifest.config?.digest?.startsWith('sha256:')) {
    return manifest.config.digest
  }

  return undefined
}

async function getLocalDockerDigest(imageName: string): Promise<string | undefined> {
  try {
    const imageInfo = await docker.getImage(imageName).inspect()
    const repoDigests = Array.isArray(imageInfo.RepoDigests)
      ? imageInfo.RepoDigests
      : []
    const digestFromRepoDigests = repoDigests
      .map((value) => /@(sha256:[a-f0-9]+)/.exec(value)?.[1])
      .find((value): value is string => Boolean(value))
    if (digestFromRepoDigests) {
      return digestFromRepoDigests
    }

    return typeof imageInfo.Id === 'string' && imageInfo.Id.startsWith('sha256:')
      ? imageInfo.Id
      : undefined
  } catch (error: unknown) {
    const err = error as { statusCode?: number; reason?: string }
    if (err.statusCode === 404) {
      return undefined
    }
    throw error
  }
}

async function ensureDockerDaemonAvailable(): Promise<void> {
  try {
    await docker.ping()
  } catch (error) {
    throw new Error(
      `Docker is not running. Please ensure the Docker daemon is active. ${
        (error as Error).message
      }`,
    )
  }
}

async function pullDockerImage(imageName: string): Promise<string | undefined> {
  await ensureDockerDaemonAvailable()

  logger.info(`Pulling Docker image for cache refresh: ${imageName}`)
  return new Promise((resolve, reject) => {
    docker.pull(
      imageName,
      (
        error: Error | null,
        stream: NodeJS.ReadableStream | undefined,
      ) => {
        if (error) {
          reject(error)
          return
        }

        if (!stream) {
          reject(new Error(`Docker did not return a pull stream for ${imageName}`))
          return
        }

        ;(docker.modem as any).followProgress(
          stream,
          async (progressError: Error | null) => {
            if (progressError) {
              reject(progressError)
              return
            }

            try {
              const localDigest = await getLocalDockerDigest(imageName)
              resolve(localDigest)
            } catch (inspectError) {
              reject(inspectError)
            }
          },
        )
      },
    )
  })
}

function getSingularityBinary(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('which', ['singularity'], (error) => {
      if (!error) {
        resolve('singularity')
        return
      }

      execFile('which', ['apptainer'], (apptainerError) => {
        if (!apptainerError) {
          resolve('apptainer')
          return
        }

        reject(
          new Error(
            'Neither Singularity nor Apptainer is installed. Please install one of them.',
          ),
        )
      })
    })
  })
}

async function findSingularityImageByHash(
  imageName: string,
  hash: string,
): Promise<string | undefined> {
  const localPattern = dockerImageToSingularityPattern(imageName)
  const candidatePath = path.join(
    SINGULARITY_IMAGES_DIR,
    `${localPattern}-${hash}.sif`,
  )

  try {
    await fs.access(candidatePath)
    return candidatePath
  } catch {
    return undefined
  }
}

async function findLatestSingularityImage(imageName: string): Promise<string | undefined> {
  const localPattern = dockerImageToSingularityPattern(imageName)
  try {
    const files = await fs.readdir(SINGULARITY_IMAGES_DIR)
    const matchingFiles = files.filter(
      (file) => file.endsWith('.sif') && file.startsWith(`${localPattern}-`),
    )

    if (matchingFiles.length === 0) {
      return undefined
    }

    const stats = await Promise.all(
      matchingFiles.map(async (file) => ({
        file,
        stat: await fs.stat(path.join(SINGULARITY_IMAGES_DIR, file)),
      })),
    )
    stats.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)
    return path.join(SINGULARITY_IMAGES_DIR, stats[0].file)
  } catch {
    return undefined
  }
}

async function removeStaleSingularityImages(
  imageName: string,
  keepHash: string,
): Promise<void> {
  const localPattern = dockerImageToSingularityPattern(imageName)
  try {
    const files = await fs.readdir(SINGULARITY_IMAGES_DIR)
    const staleFiles = files.filter(
      (file) =>
        file.endsWith('.sif') &&
        file.startsWith(`${localPattern}-`) &&
        !file.includes(`-${keepHash}.sif`),
    )

    await Promise.all(
      staleFiles.map((file) =>
        removeFileIfPresent(path.join(SINGULARITY_IMAGES_DIR, file)),
      ),
    )
  } catch (error) {
    logger.warn(`Failed to remove stale Singularity images for ${imageName}`, {
      error,
    })
  }
}

async function removeFileIfPresent(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== 'ENOENT') {
      throw error
    }
  }
}

async function buildSingularityImage(
  imageName: string,
  targetHash: string,
): Promise<string> {
  await fs.mkdir(SINGULARITY_IMAGES_DIR, { recursive: true })
  const localPattern = dockerImageToSingularityPattern(imageName)
  const finalPath = path.join(
    SINGULARITY_IMAGES_DIR,
    `${localPattern}-${targetHash}.sif`,
  )
  const tempPath = path.join(
    SINGULARITY_IMAGES_DIR,
    `${localPattern}-${targetHash}.tmp.sif`,
  )

  const existingImage = await findSingularityImageByHash(imageName, targetHash)
  if (existingImage) {
    return existingImage
  }

  const singularityBinary = await getSingularityBinary()
  await removeFileIfPresent(tempPath)

  logger.info(`Building Singularity image for cache refresh: ${imageName}`)
  return new Promise((resolve, reject) => {
    const processHandle = spawn(singularityBinary, [
      'pull',
      tempPath,
      `docker://${imageName}`,
    ])

    let stdout = ''
    let stderr = ''

    processHandle.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    processHandle.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    processHandle.on('error', async (error: Error) => {
      await removeFileIfPresent(tempPath)
      reject(error)
    })

    processHandle.on('close', async (code: number | null) => {
      if (code !== 0) {
        await removeFileIfPresent(tempPath)
        reject(new Error(stderr || stdout || `Exit Code: ${code}`))
        return
      }

      try {
        await fs.rename(tempPath, finalPath)
        await removeStaleSingularityImages(imageName, targetHash)
        resolve(finalPath)
      } catch (error) {
        await removeFileIfPresent(tempPath)
        reject(error)
      }
    })
  })
}

async function trackImage(imageName: string): Promise<ImageCacheEntry> {
  const entry = ensureImageEntry(imageName)
  entry.lastSeenAt = nowIso()
  await persistCacheState()
  return entry
}

async function updateRemoteDigest(imageName: string): Promise<string | undefined> {
  const entry = ensureImageEntry(imageName)
  entry.lastCheckedAt = nowIso()

  try {
    const remoteDigest = await getRemoteImageDigest(imageName)
    if (remoteDigest) {
      entry.remoteDigest = remoteDigest
    }
    await persistCacheState()
    return remoteDigest
  } catch (error) {
    logger.warn(`Failed to resolve remote digest for ${imageName}`, { error })
    await persistCacheState()
    return entry.remoteDigest
  }
}

function pullDockerImageIfNeeded(
  imageName: string,
  targetDigest: string | undefined,
): Promise<string | undefined> {
  const existingPull = activeDockerPulls.get(imageName)
  if (existingPull) {
    return existingPull
  }

  const pullPromise = (async () => {
    const entry = ensureImageEntry(imageName)
    entry.docker.status = 'pulling'
    entry.docker.lastPullAttemptAt = nowIso()
    entry.docker.lastError = undefined
    await persistCacheState()

    try {
      const localDigest = await pullDockerImage(imageName)
      entry.docker.localDigest = localDigest
      entry.docker.lastPulledAt = nowIso()
      entry.docker.status = localDigest ? 'ready' : 'missing'
      if (targetDigest) {
        entry.remoteDigest = targetDigest
      }
      await persistCacheState()
      logger.info(`Docker image cache is ready for ${imageName}`)
      return localDigest
    } catch (error) {
      entry.docker.status = 'failed'
      entry.docker.lastError = (error as Error).message
      await persistCacheState()
      throw error
    } finally {
      activeDockerPulls.delete(imageName)
    }
  })()

  activeDockerPulls.set(imageName, pullPromise)
  return pullPromise
}

function queueSingularityBuild(
  imageName: string,
  targetDigest: string,
): Promise<string> {
  const existingBuild = activeSingularityBuilds.get(imageName)
  if (existingBuild) {
    return existingBuild
  }

  const buildPromise = singularityBuildQueue.then(async () => {
    const targetHash = digestToShortHash(targetDigest)
    const entry = ensureImageEntry(imageName)
    entry.singularity.status = 'running'
    entry.singularity.lastBuildAttemptAt = nowIso()
    entry.singularity.lastError = undefined
    entry.remoteDigest = targetDigest
    await persistCacheState()

    try {
      const imagePath = await buildSingularityImage(imageName, targetHash)
      entry.singularity.currentHash = targetHash
      entry.singularity.status = 'ready'
      entry.singularity.lastBuiltAt = nowIso()
      await persistCacheState()
      logger.info(`Singularity image cache is ready for ${imageName}: ${imagePath}`)
      return imagePath
    } catch (error) {
      entry.singularity.status = 'failed'
      entry.singularity.lastError = (error as Error).message
      await persistCacheState()
      throw error
    } finally {
      activeSingularityBuilds.delete(imageName)
    }
  })

  singularityBuildQueue = buildPromise.then(
    () => undefined,
    () => undefined,
  )
  activeSingularityBuilds.set(imageName, buildPromise)
  return buildPromise
}

async function refreshDockerCache(imageName: string, remoteDigest?: string): Promise<void> {
  const entry = ensureImageEntry(imageName)
  try {
    const localDigest = await getLocalDockerDigest(imageName)
    entry.docker.localDigest = localDigest

    if (!localDigest) {
      entry.docker.status = 'pulling'
      await persistCacheState()
      void pullDockerImageIfNeeded(imageName, remoteDigest)
      return
    }

    if (remoteDigest && localDigest !== remoteDigest) {
      entry.docker.status = 'pulling'
      await persistCacheState()
      void pullDockerImageIfNeeded(imageName, remoteDigest)
      return
    }

    entry.docker.status = 'ready'
    entry.docker.lastError = undefined
    await persistCacheState()
  } catch (error) {
    entry.docker.status = 'failed'
    entry.docker.lastError = (error as Error).message
    await persistCacheState()
    logger.warn(`Failed to refresh Docker cache state for ${imageName}`, { error })
  }
}

async function refreshSingularityCache(
  imageName: string,
  remoteDigest?: string,
): Promise<void> {
  const entry = ensureImageEntry(imageName)
  try {
    if (!remoteDigest) {
      const latestLocalImage = await findLatestSingularityImage(imageName)
      if (latestLocalImage) {
        entry.singularity.status = 'ready'
      } else {
        entry.singularity.status = 'missing'
      }
      await persistCacheState()
      return
    }

    const targetHash = digestToShortHash(remoteDigest)
    const exactMatch = await findSingularityImageByHash(imageName, targetHash)
    if (exactMatch) {
      entry.singularity.currentHash = targetHash
      entry.singularity.status = 'ready'
      entry.singularity.lastError = undefined
      await persistCacheState()
      return
    }

    entry.singularity.currentHash = targetHash
    entry.singularity.status = activeSingularityBuilds.has(imageName)
      ? 'running'
      : 'pending'
    await persistCacheState()
    void queueSingularityBuild(imageName, remoteDigest)
  } catch (error) {
    entry.singularity.status = 'failed'
    entry.singularity.lastError = (error as Error).message
    await persistCacheState()
    logger.warn(`Failed to refresh Singularity cache state for ${imageName}`, {
      error,
    })
  }
}

async function refreshTrackedImage(imageName: string): Promise<void> {
  const remoteDigest = await updateRemoteDigest(imageName)
  await refreshDockerCache(imageName, remoteDigest)
  await refreshSingularityCache(imageName, remoteDigest)
}

async function fetchAllowedImageNames(): Promise<string[]> {
  try {
    const vaultConfig = await getVaultConfig()
    allowedImageNames = Array.from(
      new Set(
        vaultConfig.allowedComputations
          .map((computation) => computation.imageName?.trim())
          .filter((imageName): imageName is string => Boolean(imageName)),
      ),
    )

    for (const imageName of allowedImageNames) {
      await trackImage(imageName)
    }

    return allowedImageNames
  } catch (error) {
    logger.warn('Failed to fetch allowed computations for vault image refresh', {
      error,
    })
    return allowedImageNames
  }
}

async function refreshTrackedImages(): Promise<void> {
  if (refreshInFlight) {
    await refreshInFlight
    return
  }

  refreshInFlight = (async () => {
    const imageNames = await fetchAllowedImageNames()
    if (imageNames.length === 0) {
      return
    }

    logger.info(`Refreshing image cache state for ${imageNames.length} tracked image(s)`)
    for (const imageName of imageNames) {
      await refreshTrackedImage(imageName)
    }
  })()

  try {
    await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

async function ensureDockerImageReady(imageName: string): Promise<void> {
  const entry = ensureImageEntry(imageName)
  const remoteDigest = await updateRemoteDigest(imageName)
  const localDigest = await getLocalDockerDigest(imageName)
  entry.docker.localDigest = localDigest

  if (localDigest && (!remoteDigest || localDigest === remoteDigest)) {
    entry.docker.status = 'ready'
    entry.docker.lastError = undefined
    await persistCacheState()
    return
  }

  try {
    const updatedLocalDigest = await pullDockerImageIfNeeded(imageName, remoteDigest)
    entry.docker.localDigest = updatedLocalDigest
    entry.docker.status = updatedLocalDigest ? 'ready' : 'missing'
    await persistCacheState()
  } catch (error) {
    if (localDigest) {
      logger.warn(
        `Docker refresh failed for ${imageName}, continuing with existing local image`,
        { error },
      )
      entry.docker.status = 'ready'
      entry.docker.lastError = (error as Error).message
      await persistCacheState()
      return
    }

    throw error
  }
}

async function ensureSingularityImageReady(imageName: string): Promise<void> {
  const entry = ensureImageEntry(imageName)
  const remoteDigest = await updateRemoteDigest(imageName)

  if (remoteDigest) {
    const targetHash = digestToShortHash(remoteDigest)
    const exactMatch = await findSingularityImageByHash(imageName, targetHash)
    if (exactMatch) {
      entry.singularity.currentHash = targetHash
      entry.singularity.status = 'ready'
      entry.singularity.lastError = undefined
      await persistCacheState()
      return
    }

    await queueSingularityBuild(imageName, remoteDigest)
    entry.singularity.currentHash = targetHash
    entry.singularity.status = 'ready'
    await persistCacheState()
    return
  }

  const localImage = await findLatestSingularityImage(imageName)
  if (localImage) {
    entry.singularity.status = 'ready'
    entry.singularity.lastError = undefined
    await persistCacheState()
    return
  }

  throw new Error(
    `Unable to resolve the latest digest for ${imageName}, and no local Singularity image is available.`,
  )
}

export async function registerTrackedImage(imageName: string): Promise<void> {
  await trackImage(imageName)
}

export async function ensureImageReadyForRun(
  imageName: string,
  containerService: ContainerService,
): Promise<void> {
  await trackImage(imageName)

  if (containerService === 'docker') {
    await ensureDockerImageReady(imageName)
    return
  }

  await ensureSingularityImageReady(imageName)
}

export async function startImageManager(): Promise<void> {
  if (refreshInterval) {
    return
  }

  await loadCacheState()
  await refreshTrackedImages()

  refreshInterval = setInterval(() => {
    void refreshTrackedImages().catch((error) => {
      logger.error('Periodic image cache refresh failed', { error })
    })
  }, IMAGE_REFRESH_INTERVAL_MS)

  logger.info(
    `Image cache refresh loop started with ${IMAGE_REFRESH_INTERVAL_MS / 60000} minute interval`,
  )
}

export async function stopImageManager(): Promise<void> {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }

  await writeStatePromise
}
