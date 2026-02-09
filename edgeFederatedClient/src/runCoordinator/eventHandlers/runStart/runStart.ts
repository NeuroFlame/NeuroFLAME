// NeuroFLAME edgeFederatedClient/src/runCoordinator/eventHandlers/runStart/runStart.ts

import { getConfig } from '../../../config/config.js'
import downloadFile from './downloadFile.js'
import { launchNode } from '../../nodeManager/launchNode.js'
import path from 'path'
import { unzipFile } from './unzipFile.js'
import fs from 'fs/promises'
import { logger } from '../../../logger.js'
import reportRunError from '../../report/reportRunError.js'

export const RUN_START_SUBSCRIPTION = `
  subscription runStartSubscription {
    runStartEdge {
      consortiumId
      runId
      imageName
      downloadUrl
      downloadToken
    }
  }
`

type ParticipantRole = 'contributor' | 'observer' | 'unknown'

const RUNSTART_DEBUG = process.env.NEUROFLAME_RUNSTART_DEBUG === 'true'

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function safeReadFile(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8')
  } catch {
    return null
  }
}

async function listTree(root: string, maxDepth = 4): Promise<string[]> {
  // Simple bounded tree listing for debugging.
  const out: string[] = []
  async function walk(dir: string, depth: number) {
    if (depth > maxDepth) return
    let entries: any[] = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      out.push(full.replace(root, '.'))
      if (ent.isDirectory()) {
        await walk(full, depth + 1)
      }
    }
  }
  await walk(root, 0)
  return out.sort()
}

async function readRoleFile(rolePath: string): Promise<ParticipantRole> {
  try {
    const raw = await fs.readFile(rolePath, 'utf-8')
    const obj = JSON.parse(raw)

    // Accept both keys to avoid provisioning/client drift
    const role = (obj?.participant_role ?? obj?.role ?? '')
      .toString()
      .trim()
      .toLowerCase()

    if (RUNSTART_DEBUG) {
      logger.info('[runStart][debug] readRoleFile', {
        rolePath,
        keys: Object.keys(obj || {}),
        parsedRole: role,
      })
    }

    if (role === 'contributor' || role === 'observer') return role
  } catch (e) {
    if (RUNSTART_DEBUG) {
      logger.warn('[runStart][debug] readRoleFile failed', { rolePath, error: String(e) })
    }
  }
  return 'unknown'
}

async function readParticipantRole(runKitPath: string): Promise<ParticipantRole> {
  // Canonical location
  const canonical = path.join(runKitPath, 'startup', 'participant_role.json')
  const r1 = await readRoleFile(canonical)
  if (r1 !== 'unknown') return r1

  // Fallbacks (older layouts)
  const fallbacks = [
    path.join(runKitPath, 'app_contrib', 'startup', 'participant_role.json'),
    path.join(runKitPath, 'app_observer', 'startup', 'participant_role.json'),
    path.join(runKitPath, 'app_contrib', 'config', 'participant_role.json'),
    path.join(runKitPath, 'app_observer', 'config', 'participant_role.json'),
  ]
  for (const p of fallbacks) {
    const r = await readRoleFile(p)
    if (r !== 'unknown') return r
  }

  // Last-ditch inference
  if (await pathExists(path.join(runKitPath, 'app_observer'))) return 'observer'
  if (await pathExists(path.join(runKitPath, 'app_contrib'))) return 'contributor'

  return 'unknown'
}

function sanitizeMounts(
  mounts: Array<{ hostDirectory: string; containerDirectory: string }>,
) {
  const cleaned = mounts.filter((m) => {
    const host = (m.hostDirectory ?? '').toString().trim()
    const cont = (m.containerDirectory ?? '').toString().trim()
    return host.length > 0 && cont.length > 0
  })
  const removed = mounts.length - cleaned.length
  if (removed > 0) {
    logger.warn(`[runStart] Removed ${removed} invalid mount(s) (empty host/container)`)
  }
  return cleaned
}

function summarizeMounts(
  mounts: Array<{ hostDirectory: string; containerDirectory: string }>,
) {
  return mounts.map((m) => ({
    hostDirectory: m.hostDirectory,
    containerDirectory: m.containerDirectory,
    hostEmpty: !(m.hostDirectory ?? '').toString().trim(),
    containerEmpty: !(m.containerDirectory ?? '').toString().trim(),
  }))
}

export const runStartHandler = {
  error: (err: any) =>
    logger.error('Run Start - Subscription error', { error: err }),
  complete: () => logger.info('Run Start - Subscription completed'),
  next: async ({ data }: { data: any }) => {
    logger.info('Run Start - Received data')
    try {
      const { consortiumId, runId, imageName, downloadUrl, downloadToken } =
        data.runStartEdge

      const config = await getConfig()
      const { pathBaseDirectory, containerService = 'docker' } = config

      const consortiumPath = path.join(pathBaseDirectory, consortiumId)
      const runPath = path.join(consortiumPath, runId)
      const runKitPath = path.join(runPath, 'runKit')
      const resultsPath = path.join(runPath, 'results')

      logger.info('[runStart] paths', {
        pathBaseDirectory,
        consortiumId,
        runId,
        consortiumPath,
        runPath,
        runKitPath,
        resultsPath,
        imageName,
        containerService,
      })

      // Ensure directories exist
      await fs.mkdir(consortiumPath, { recursive: true, mode: 0o777 })
      await fs.mkdir(runPath, { recursive: true, mode: 0o777 })
      await fs.mkdir(runKitPath, { recursive: true, mode: 0o777 })
      await fs.mkdir(resultsPath, { recursive: true, mode: 0o777 })

      const mountConfigPath = path.join(consortiumPath, 'mount_config.json')

      // Download runKit zip
      logger.info('[runStart] downloading kit.zip', { downloadUrl })
      await downloadFile({
        url: downloadUrl,
        accessToken: downloadToken,
        pathOutputDir: runKitPath,
        outputFilename: 'kit.zip',
      })

      // Unzip
      logger.info('[runStart] unzipping kit.zip', { runKitPath })
      await unzipFile({ directory: runKitPath, fileName: 'kit.zip' })

      if (RUNSTART_DEBUG) {
        const tree = await listTree(runKitPath, 5)
        logger.info('[runStart][debug] runKit tree after unzip', { tree })
        const canonicalRolePath = path.join(runKitPath, 'startup', 'participant_role.json')
        const roleRaw = await safeReadFile(canonicalRolePath)
        logger.info('[runStart][debug] canonical participant_role.json (raw)', {
          canonicalRolePath,
          exists: roleRaw !== null,
          raw: roleRaw,
        })
      }

      // Determine role (default unknown -> observer for safety)
      const role = await readParticipantRole(runKitPath)
      const effectiveRole: ParticipantRole = role === 'unknown' ? 'observer' : role
      logger.info(`[runStart] participant role: ${role} (effective: ${effectiveRole})`)

      // Always mount runKit + output
      const directoriesToMount: Array<{ hostDirectory: string; containerDirectory: string }> = [
        { hostDirectory: runKitPath, containerDirectory: '/workspace/runKit' },
        { hostDirectory: resultsPath, containerDirectory: '/workspace/output' },
      ]

      // Contributors: require dataPath and mount /workspace/data
      // Observers: do not read mount_config.json and do not mount /workspace/data
      if (effectiveRole === 'contributor') {
        const mountConfigRaw = await fs.readFile(mountConfigPath, 'utf-8')
        const mountConfig = JSON.parse(mountConfigRaw)
        const dataPath = (mountConfig?.dataPath ?? '').toString().trim()

        logger.info(`[runStart] mount_config.json dataPath: "${dataPath}"`)

        if (!dataPath) {
          throw new Error('[runStart] Contributor requires mountConfig.dataPath but it was empty')
        }
        await fs.access(dataPath)

        directoriesToMount.push({
          hostDirectory: dataPath,
          containerDirectory: '/workspace/data',
        })
        logger.info('[runStart] Mounting /workspace/data for contributor')
      } else {
        logger.info('[runStart] Observer: skipping mount_config.json and /workspace/data mount')
      }

      // Log before/after sanitize (always)
      logger.info('[runStart] directoriesToMount (raw)', {
        mounts: summarizeMounts(directoriesToMount),
      })

      const cleanedMounts = sanitizeMounts(directoriesToMount)

      logger.info('[runStart] directoriesToMount (cleaned)', {
        mounts: summarizeMounts(cleanedMounts),
      })

      // Fail fast if anything tries to mount /workspace/data with empty host
      const badDataMount = cleanedMounts.find(
        (m) =>
          (m.containerDirectory ?? '').toString().trim() === '/workspace/data' &&
          !(m.hostDirectory ?? '').toString().trim(),
      )
      if (badDataMount) {
        throw new Error(
          '[runStart] Refusing to launch: /workspace/data mount has empty hostDirectory',
        )
      }

      // Extra assert: observers should not have a data mount at all
      if (effectiveRole !== 'contributor') {
        const hasDataMount = cleanedMounts.some(
          (m) => (m.containerDirectory ?? '').toString().trim() === '/workspace/data',
        )
        if (hasDataMount) {
          throw new Error(
            `[runStart] Observer had an unexpected /workspace/data mount. mounts=${JSON.stringify(
              summarizeMounts(cleanedMounts),
            )}`,
          )
        }
      }

      // Launch container
      await launchNode({
        containerService,
        imageName,
        directoriesToMount: cleanedMounts,
        portBindings: [],
        // Create /workspace/data even for observers so code that expects it doesn't crash
        commandsToRun: [
          'bash',
          '-lc',
          'mkdir -p /workspace/data && python /workspace/system/entry_edge.py',
        ],
        onContainerExitError: async (containerId, error) => {
          logger.error(`[runStart] onContainerExitError called for container: ${containerId}`, {
            error,
          })
          try {
            await reportRunError({
              runId,
              errorMessage: `Error in container ${containerId}: ${error}`,
            })
          } catch (err) {
            logger.error(`[runStart] Error calling reportRunError: ${err}`)
            logger.error(
              `[runStart] Error stack: ${err instanceof Error ? err.stack : 'No stack trace'}`,
            )
            throw err
          }
        },
        onContainerExitSuccess(containerId) {
          logger.info(`Container exited successfully: ${containerId}`)
        },
      })
    } catch (error) {
      logger.error('Error in runStartHandler', { error })

      await reportRunError({
        runId: data.runStartEdge.runId,
        errorMessage: `Error starting run: ${(error as Error).message}`,
      })
    }
  },
}
