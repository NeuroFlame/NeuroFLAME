import axios from 'axios'
import { execFile, spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/
const PATH_COMPONENT = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/
const TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/
const DOMAIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::[0-9]+)?$/
const REGISTRY_TIMEOUT_MS = 30_000

// Accepting index types makes the registry report the same digest Docker records.
const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ')

export interface ImageReference {
  domain: string
  repository: string
  tag: string
  digest?: string
}

/** Parses a Docker image reference using the distribution reference rules. */
export function parseImageReference(image: string): ImageReference {
  if (typeof image !== 'string' || image.length > 512) {
    throw new Error('Invalid image reference')
  }
  let remainder = image
  let digest: string | undefined
  const at = remainder.indexOf('@')
  if (at !== -1) {
    digest = remainder.slice(at + 1)
    remainder = remainder.slice(0, at)
    if (!DIGEST_PATTERN.test(digest)) throw new Error('Invalid image reference')
  }
  let tag = 'latest'
  const colon = remainder.lastIndexOf(':')
  if (colon > remainder.lastIndexOf('/')) {
    tag = remainder.slice(colon + 1)
    remainder = remainder.slice(0, colon)
    if (!TAG_PATTERN.test(tag)) throw new Error('Invalid image reference')
  }
  const components = remainder.split('/')
  let domain = 'docker.io'
  if (
    components.length > 1 &&
    (components[0].includes('.') || components[0].includes(':') || components[0] === 'localhost')
  ) {
    domain = components.shift() as string
    if (!DOMAIN_PATTERN.test(domain)) throw new Error('Invalid image reference')
  }
  if (domain === 'docker.io' && components.length === 1) {
    components.unshift('library')
  }
  if (!components.every((component) => PATH_COMPONENT.test(component))) {
    throw new Error('Invalid image reference')
  }
  return { domain, repository: components.join('/'), tag, digest }
}

const registryHost = (domain: string) =>
  domain === 'docker.io' ? 'registry-1.docker.io' : domain

/** Public images still need an anonymous bearer token from the registry's auth service. */
async function anonymousToken(challenge: unknown): Promise<string> {
  if (typeof challenge !== 'string' || !/^Bearer\s/i.test(challenge)) {
    throw new Error('Registry requires authentication this client does not support')
  }
  const params = Object.fromEntries(
    [...challenge.matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
  )
  const realm = new URL(params.realm)
  if (realm.protocol !== 'https:') {
    throw new Error('Registry token service must use HTTPS')
  }
  if (params.service) realm.searchParams.set('service', params.service)
  if (params.scope) realm.searchParams.set('scope', params.scope)
  const response = await axios.get(realm.toString(), { timeout: REGISTRY_TIMEOUT_MS })
  const token = response.data?.token ?? response.data?.access_token
  if (typeof token !== 'string' || !token) {
    throw new Error('Registry token service returned no token')
  }
  return token
}

/** Resolves a tag to the registry digest it currently points to. */
export async function resolveRegistryDigest(reference: ImageReference): Promise<string> {
  if (reference.digest) return reference.digest
  const url = `https://${registryHost(reference.domain)}/v2/${reference.repository}/manifests/${reference.tag}`
  const request = (authorization?: string) => axios.head(url, {
    headers: {
      Accept: MANIFEST_ACCEPT,
      ...(authorization ? { Authorization: authorization } : {}),
    },
    timeout: REGISTRY_TIMEOUT_MS,
    validateStatus: () => true,
  })
  let response = await request()
  if (response.status === 401) {
    response = await request(`Bearer ${await anonymousToken(response.headers['www-authenticate'])}`)
  }
  if (response.status !== 200) {
    throw new Error(`Registry returned ${response.status} for the image manifest`)
  }
  const digest = response.headers['docker-content-digest']
  if (typeof digest !== 'string' || !DIGEST_PATTERN.test(digest)) {
    throw new Error('Registry did not report a valid image digest')
  }
  return digest
}

/** The pull reference Apptainer is given; always pinned to a digest. */
export const pinnedReference = (reference: ImageReference, digest: string): string =>
  `${reference.domain}/${reference.repository}@${digest}`

/**
 * One cache entry per repository and digest, so a pull made from the UI before a
 * run is found again when the run starts with the same pinned digest.
 */
export function singularityImagePath(
  baseDirectory: string,
  reference: ImageReference,
  digest: string,
): string {
  const name = `${reference.domain}/${reference.repository}`.replace(/[/:]/g, '_')
  return path.join(
    baseDirectory,
    'singularityImages',
    `${name}-${digest.slice('sha256:'.length)}.sif`,
  )
}

export function getSingularityBinary(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('which', ['singularity'], (singularityError) => {
      if (!singularityError) {
        resolve('singularity')
        return
      }
      execFile('which', ['apptainer'], (apptainerError) => {
        if (!apptainerError) {
          resolve('apptainer')
          return
        }
        reject(new Error('Neither Singularity nor Apptainer is installed'))
      })
    })
  })
}

const pullsInFlight = new Map<string, Promise<void>>()

async function pullToCache(binary: string, pullReference: string, imagePath: string): Promise<void> {
  await fs.mkdir(path.dirname(imagePath), { recursive: true, mode: 0o700 })
  // A unique temporary name keeps an abandoned or concurrent pull from being renamed in.
  const temporaryPath = `${imagePath}.${randomUUID()}.tmp`
  try {
    await new Promise<void>((resolve, reject) => {
      const processHandle = spawn(binary, ['pull', temporaryPath, `docker://${pullReference}`])
      let stderr = ''
      processHandle.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })
      processHandle.on('error', reject)
      processHandle.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(stderr || `Singularity pull exited with code ${code}`))
        }
      })
    })
    await fs.rename(temporaryPath, imagePath)
  } finally {
    await fs.rm(temporaryPath, { force: true })
  }
}

/**
 * Makes sure the image is in the cache. Concurrent requests for the same image
 * (the UI button and a run start) share one pull.
 * @returns whether the image was already cached
 */
export async function ensureSingularityImage(
  binary: string,
  pullReference: string,
  imagePath: string,
): Promise<boolean> {
  const pending = pullsInFlight.get(imagePath)
  if (pending) {
    await pending
    return false
  }
  try {
    await fs.access(imagePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const pull = pullToCache(binary, pullReference, imagePath)
  pullsInFlight.set(imagePath, pull)
  try {
    await pull
  } finally {
    pullsInFlight.delete(imagePath)
  }
  return false
}

/**
 * Pulls an image ahead of a run. With no run there is nothing pinned yet, so a
 * tag is resolved to the digest it points to now.
 */
export async function pullSingularityImage(
  image: string,
  baseDirectory: string,
): Promise<{ alreadyExists: boolean }> {
  const reference = parseImageReference(image)
  const digest = await resolveRegistryDigest(reference)
  const binary = await getSingularityBinary()
  const alreadyExists = await ensureSingularityImage(
    binary,
    pinnedReference(reference, digest),
    singularityImagePath(baseDirectory, reference, digest),
  )
  return { alreadyExists }
}

export async function isSingularityImageCached(
  image: string,
  baseDirectory: string,
): Promise<boolean> {
  const reference = parseImageReference(image)
  const digest = await resolveRegistryDigest(reference)
  try {
    await fs.access(singularityImagePath(baseDirectory, reference, digest))
    return true
  } catch {
    return false
  }
}
