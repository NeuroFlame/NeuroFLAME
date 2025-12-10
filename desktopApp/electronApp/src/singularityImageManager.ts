import { spawn, execFile } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from './logger.js'
import { getConfig } from './config.js'
import https from 'https'
import http from 'http'

/**
 * Get Docker image digest from Docker Hub using network API call
 * This works without Docker being installed
 */
async function getDockerImageDigest(dockerImageName: string): Promise<string> {
  // Parse image name: user/repo:tag or repo:tag
  const imageWithoutTag = dockerImageName.replace(/:latest$/, '')
  const parts = imageWithoutTag.split(':')
  const namePart = parts[0]
  const tag = parts[1] || 'latest'
  
  // Handle Docker Hub official images (no namespace)
  const nameParts = namePart.split('/')
  let namespace: string
  let repository: string
  
  if (nameParts.length === 1) {
    // Official image like "ubuntu" -> library/ubuntu
    namespace = 'library'
    repository = nameParts[0]
  } else {
    namespace = nameParts[0]
    repository = nameParts.slice(1).join('/')
  }

  // Docker Registry API v2 endpoint
  const registryUrl = `https://registry-1.docker.io/v2/${namespace}/${repository}/manifests/${tag}`
  
  return new Promise((resolve, reject) => {
    const url = new URL(registryUrl)
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'HEAD', // Use HEAD to get headers only
      headers: {
        'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json',
      },
    }

    const req = https.request(options, (res) => {
      // Try to get digest from Docker-Content-Digest header
      const digestHeader = res.headers['docker-content-digest']
      if (digestHeader && typeof digestHeader === 'string') {
        // Extract hash from sha256:hash format
        const hashMatch = digestHeader.match(/sha256:([a-f0-9]+)/)
        if (hashMatch) {
          resolve(hashMatch[1])
          return
        }
      }

      // If HEAD doesn't work or doesn't return digest, try GET
      const getOptions = {
        ...options,
        method: 'GET',
      }
      
      const getReq = https.request(getOptions, (getRes) => {
        let data = ''
        
        getRes.on('data', (chunk) => {
          data += chunk.toString()
        })
        
        getRes.on('end', () => {
          try {
            const manifest = JSON.parse(data)
            // Try to get digest from config digest
            if (manifest.config?.digest) {
              const hashMatch = manifest.config.digest.match(/sha256:([a-f0-9]+)/)
              if (hashMatch) {
                resolve(hashMatch[1])
                return
              }
            }
            // Fallback: use the digest from the response header if available
            const contentDigest = getRes.headers['docker-content-digest']
            if (contentDigest && typeof contentDigest === 'string') {
              const hashMatch = contentDigest.match(/sha256:([a-f0-9]+)/)
              if (hashMatch) {
                resolve(hashMatch[1])
                return
              }
            }
            // Last resort: generate hash from image name
            logger.warn(
              `Could not extract digest from manifest for ${dockerImageName}, using fallback`,
            )
            const fallbackHash = Buffer.from(dockerImageName).toString('base64').slice(0, 12)
            resolve(fallbackHash)
          } catch (parseError) {
            logger.warn(
              `Failed to parse manifest for ${dockerImageName}, using fallback`,
            )
            const fallbackHash = Buffer.from(dockerImageName).toString('base64').slice(0, 12)
            resolve(fallbackHash)
          }
        })
      })
      
      getReq.on('error', (error) => {
        logger.warn(
          `Network error getting manifest for ${dockerImageName}: ${error.message}, using fallback`,
        )
        const fallbackHash = Buffer.from(dockerImageName).toString('base64').slice(0, 12)
        resolve(fallbackHash)
      })
      
      getReq.end()
    })

    req.on('error', (error) => {
      // If HEAD fails, try GET as fallback
      const getOptions = {
        ...options,
        method: 'GET',
      }
      
      const getReq = https.request(getOptions, (getRes) => {
        let data = ''
        
        getRes.on('data', (chunk) => {
          data += chunk.toString()
        })
        
        getRes.on('end', () => {
          try {
            const manifest = JSON.parse(data)
            if (manifest.config?.digest) {
              const hashMatch = manifest.config.digest.match(/sha256:([a-f0-9]+)/)
              if (hashMatch) {
                resolve(hashMatch[1])
                return
              }
            }
            logger.warn(
              `Could not extract digest for ${dockerImageName}, using fallback`,
            )
            const fallbackHash = Buffer.from(dockerImageName).toString('base64').slice(0, 12)
            resolve(fallbackHash)
          } catch (parseError) {
            logger.warn(
              `Failed to parse manifest for ${dockerImageName}, using fallback`,
            )
            const fallbackHash = Buffer.from(dockerImageName).toString('base64').slice(0, 12)
            resolve(fallbackHash)
          }
        })
      })
      
      getReq.on('error', (getError) => {
        logger.warn(
          `Network error getting manifest for ${dockerImageName}: ${getError.message}, using fallback`,
        )
        const fallbackHash = Buffer.from(dockerImageName).toString('base64').slice(0, 12)
        resolve(fallbackHash)
      })
      
      getReq.end()
    })

    req.end()
  })
}

/**
 * Convert Docker image name to Singularity image name pattern
 */
function dockerImageToSingularityPattern(dockerImageName: string): string {
  return dockerImageName
    .replace(/:latest$/, '')
    .replace(/[:@]/g, '_')
    .replace(/\//g, '_')
    .toLowerCase()
}

/**
 * Check if Singularity image with hash exists
 */
async function singularityImageExists(
  imageDirectory: string,
  localImagePattern: string,
  hash: string,
): Promise<boolean> {
  try {
    const files = await fs.readdir(imageDirectory)
    const imageNameWithHash = `${localImagePattern}-${hash}.sif`
    return files.some((file) => file === imageNameWithHash)
  } catch {
    return false
  }
}

/**
 * Get the Singularity binary (singularity or apptainer)
 */
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

/**
 * Pull and convert Docker image to Singularity format
 */
export async function pullSingularityImage(
  dockerImageName: string,
): Promise<{ imagePath: string; alreadyExists: boolean }> {
  const config = await getConfig()
  const imageDirectory = path.join(
    config.edgeClientConfig.pathBaseDirectory,
    'singularityImages',
  )

  // Ensure directory exists
  await fs.mkdir(imageDirectory, { recursive: true })

  // Get Docker digest
  const digest = await getDockerImageDigest(dockerImageName)
  const hash = digest.slice(0, 12) // Use first 12 chars like old code
  const localImagePattern = dockerImageToSingularityPattern(dockerImageName)
  const imageNameWithHash = `${localImagePattern}-${hash}.sif`
  const imagePath = path.join(imageDirectory, imageNameWithHash)

  // Check if image already exists
  const exists = await singularityImageExists(
    imageDirectory,
    localImagePattern,
    hash,
  )

  if (exists) {
    logger.info(`Singularity image already exists: ${imagePath}`)
    return { imagePath, alreadyExists: true }
  }

  // Get Singularity binary
  const singularityBinary = await getSingularityBinary()

  // Remove old images with the same pattern but different hash
  try {
    const files = await fs.readdir(imageDirectory)
    const oldImages = files.filter(
      (file) =>
        file.endsWith('.sif') &&
        file.includes(localImagePattern) &&
        !file.includes(hash),
    )
    await Promise.all(
      oldImages.map((oldImage) =>
        fs.rm(path.join(imageDirectory, oldImage), { force: true }),
      ),
    )
  } catch (error) {
    logger.warn(`Error removing old images: ${error}`)
  }

  // Pull and convert
  return new Promise((resolve, reject) => {
    logger.info(
      `Pulling Singularity image: ${singularityBinary} pull ${imagePath} docker://${dockerImageName}`,
    )

    const pullProcess = spawn(singularityBinary, [
      'pull',
      imagePath,
      `docker://${dockerImageName}`,
    ])

    let stdout = ''
    let stderr = ''

    pullProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      stdout += output
      logger.info(`Singularity pull stdout: ${output.trim()}`)
    })

    pullProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()
      stderr += output
      logger.info(`Singularity pull stderr: ${output.trim()}`)
    })

    pullProcess.on('error', (error: Error) => {
      logger.error(`Failed to start Singularity pull: ${error.message}`)
      reject(error)
    })

    pullProcess.on('close', (code: number | null) => {
      if (code === null || code !== 0) {
        const errorMessage = stderr || stdout || `Exit Code: ${code}`
        logger.error(`Singularity pull failed: ${errorMessage}`)
        reject(new Error(errorMessage))
      } else {
        logger.info(`Singularity image pulled successfully: ${imagePath}`)
        resolve({ imagePath, alreadyExists: false })
      }
    })
  })
}

/**
 * Check if a Singularity image exists for a given Docker image
 */
export async function checkSingularityImageExists(
  dockerImageName: string,
): Promise<boolean> {
  const config = await getConfig()
  const imageDirectory = path.join(
    config.edgeClientConfig.pathBaseDirectory,
    'singularityImages',
  )

  try {
    const digest = await getDockerImageDigest(dockerImageName)
    const hash = digest.slice(0, 12)
    const localImagePattern = dockerImageToSingularityPattern(dockerImageName)
    return await singularityImageExists(imageDirectory, localImagePattern, hash)
  } catch {
    return false
  }
}

