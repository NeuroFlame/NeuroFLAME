import Docker from 'dockerode'
import { execFile, spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

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
  if (!resolvedImage.reference.endsWith(`@${resolvedImage.digest}`)) {
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
  const labels = inspection.Config?.Labels ?? {}
  for (const [field, label] of Object.entries(LABELS) as Array<
    [keyof ComputationImageMetadata, string]
  >) {
    if (labels[label] !== resolvedImage.metadata[field]) {
      throw new Error(`Computation image label "${label}" does not match the run`)
    }
  }
  return resolvedImage.reference
}

function getSingularityBinary(): Promise<string> {
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

async function prepareSingularityImage(
  resolvedImage: ResolvedComputationImage,
  baseDirectory: string,
): Promise<string> {
  const imageDirectory = path.join(baseDirectory, 'singularityImages')
  await fs.mkdir(imageDirectory, { recursive: true, mode: 0o700 })
  const pattern = resolvedImage.sourceImage
    .replace(/:latest$/, '')
    .replace(/[:@/]/g, '_')
    .toLowerCase()
  const imagePath = path.join(
    imageDirectory,
    `${pattern}-${resolvedImage.digest.slice('sha256:'.length, 19)}.sif`,
  )
  try {
    await fs.access(imagePath)
    return imagePath
  } catch {
    // Pull the exact content-addressed image below.
  }

  const temporaryPath = `${imagePath}.tmp`
  await fs.rm(temporaryPath, { force: true })
  const binary = await getSingularityBinary()
  await new Promise<void>((resolve, reject) => {
    const processHandle = spawn(binary, [
      'pull',
      temporaryPath,
      `docker://${resolvedImage.reference}`,
    ])
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
    return prepareSingularityImage(resolvedImage, baseDirectory)
  }
  throw new Error(`Unsupported container service: ${containerService}`)
}
