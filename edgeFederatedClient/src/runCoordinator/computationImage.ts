import Docker from 'dockerode'
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import {
  ensureSingularityImage,
  getSingularityBinary,
  parseImageReference,
  pinnedReference,
  singularityImagePath,
} from './singularityImageCache.js'

const docker = new Docker()

export interface ComputationImageMetadata {
  title: string
  computationVersion: string
  revision: string
  source: string
  computationApiVersion: string
  boilerplateVersion: string
  nvflareVersion: string
}

export interface ResolvedComputationImage {
  sourceImage: string
  reference: string
  digest: string
  metadata: ComputationImageMetadata
}

const LABELS: Record<keyof ComputationImageMetadata, string> = {
  title: 'org.opencontainers.image.title',
  computationVersion: 'org.opencontainers.image.version',
  revision: 'org.opencontainers.image.revision',
  source: 'org.opencontainers.image.source',
  computationApiVersion: 'org.neuroflame.computation-api.version',
  boilerplateVersion: 'org.neuroflame.boilerplate.version',
  nvflareVersion: 'org.neuroflame.nvflare.version',
}

function validateResolvedImage(resolvedImage: ResolvedComputationImage): void {
  if (!/^sha256:[0-9a-f]{64}$/.test(resolvedImage.digest)) {
    throw new Error('Resolved computation image digest is invalid')
  }
  if (
    resolvedImage.reference !== resolvedImage.digest &&
    !resolvedImage.reference.endsWith(`@${resolvedImage.digest}`)
  ) {
    throw new Error('Resolved computation image reference does not match its digest')
  }
}

async function pullDockerImage(reference: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    docker.pull(
      reference,
      (
        error: Error | null,
        stream: NodeJS.ReadableStream | undefined,
      ) => {
        if (error) {
          reject(error)
          return
        }
        if (!stream) {
          reject(new Error(`Docker did not return a pull stream for ${reference}`))
          return
        }
        docker.modem.followProgress(stream, (progressError) => {
          if (progressError) {
            reject(progressError)
            return
          }
          resolve()
        })
      },
    )
  })
}

async function prepareDockerImage(
  resolvedImage: ResolvedComputationImage,
): Promise<string> {
  let inspection: Docker.ImageInspectInfo
  const isLocalImage = resolvedImage.reference === resolvedImage.digest
  if (isLocalImage) {
    inspection = await docker.getImage(resolvedImage.reference).inspect()
    if (inspection.Id !== resolvedImage.digest) {
      throw new Error('Local computation image ID does not match the run')
    }
  } else {
    try {
      await pullDockerImage(resolvedImage.reference)
      inspection = await docker.getImage(resolvedImage.reference).inspect()
    } catch (error) {
      try {
        inspection = await docker.getImage(resolvedImage.reference).inspect()
      } catch {
        throw error
      }
    }
  }
  assertImageLabels(inspection.Config?.Labels ?? {}, resolvedImage.metadata)
  return resolvedImage.reference
}

function assertImageLabels(
  labels: Record<string, unknown>,
  metadata: ComputationImageMetadata,
): void {
  for (const [field, label] of Object.entries(LABELS) as Array<
    [keyof ComputationImageMetadata, string]
  >) {
    // Central records trimmed label values, so compare them the same way.
    const value = labels[label]
    if (typeof value !== 'string' || value.trim() !== metadata[field]) {
      throw new Error(`Computation image label "${label}" does not match the run`)
    }
  }
}

/** OCI labels of a Docker image are carried into the SIF built from it. */
export async function readSingularityLabels(
  binary: string,
  imagePath: string,
): Promise<Record<string, unknown>> {
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      binary,
      ['inspect', '--labels', '--json', imagePath],
      { maxBuffer: 1024 * 1024, timeout: 120_000 },
      (error, output) => (error ? reject(error) : resolve(output)),
    )
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('Singularity returned unreadable image labels')
  }
  const labels = (parsed as { data?: { attributes?: { labels?: unknown } } })
    ?.data?.attributes?.labels
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
    throw new Error('Singularity did not report image labels')
  }
  return labels as Record<string, unknown>
}

async function prepareSingularityImage(
  resolvedImage: ResolvedComputationImage,
  baseDirectory: string,
): Promise<string> {
  const reference = parseImageReference(resolvedImage.reference)
  const imagePath = singularityImagePath(baseDirectory, reference, resolvedImage.digest)
  const binary = await getSingularityBinary()
  const alreadyCached = await ensureSingularityImage(
    binary,
    pinnedReference(reference, resolvedImage.digest),
    imagePath,
  )
  // Cached images, including ones pulled from the UI, get the same label check as a fresh pull.
  try {
    assertImageLabels(await readSingularityLabels(binary, imagePath), resolvedImage.metadata)
  } catch (error) {
    if (!alreadyCached) await fs.rm(imagePath, { force: true })
    throw error
  }
  return imagePath
}

export async function prepareComputationImage(
  resolvedImage: ResolvedComputationImage,
  containerService: string,
  baseDirectory: string,
): Promise<string> {
  validateResolvedImage(resolvedImage)
  if (containerService === 'docker') {
    return prepareDockerImage(resolvedImage)
  }
  if (containerService === 'singularity') {
    if (resolvedImage.reference === resolvedImage.digest) {
      throw new Error(
        'Local computation images require the Docker container service',
      )
    }
    return prepareSingularityImage(resolvedImage, baseDirectory)
  }
  throw new Error(`Unsupported container service: ${containerService}`)
}
