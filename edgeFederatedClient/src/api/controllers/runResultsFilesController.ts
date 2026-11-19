import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import { getConfig } from '../../config/config.js'
import { logger } from '../../logger.js'

interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  lastModified: Date;
  url: string;
}

interface TerminalErrorMarker {
  schema_version?: unknown;
  origin?: unknown;
  stage?: unknown;
  scope?: unknown;
  error_type?: unknown;
  message?: unknown;
}

const MAX_ERROR_FIELD_LENGTH = 2000
const MAX_MARKER_BYTES = 64 * 1024

const isWithin = (base: string, candidate: string): boolean =>
  candidate === base || candidate.startsWith(`${base}${path.sep}`)

// Results directories are written by the computation, which can plant symlinks.
// Resolve them and refuse anything that leaves the run's results directory.
const realPathWithin = async (base: string, candidate: string): Promise<string | undefined> => {
  try {
    const [realBase, realCandidate] = await Promise.all([
      fs.promises.realpath(base),
      fs.promises.realpath(candidate),
    ])
    return isWithin(realBase, realCandidate) ? realCandidate : undefined
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

const readMarker = async (markerPath: string): Promise<string | undefined> => {
  let handle: Awaited<ReturnType<typeof fs.promises.open>> | undefined
  try {
    const markerStats = await fs.promises.lstat(markerPath)
    if (!markerStats.isFile() || markerStats.size > MAX_MARKER_BYTES) return undefined
    handle = await fs.promises.open(markerPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0))
    const contents = await handle.readFile()
    return contents.byteLength > MAX_MARKER_BYTES ? undefined : contents.toString('utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  } finally {
    await handle?.close()
  }
}

const cleanErrorField = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim().slice(0, MAX_ERROR_FIELD_LENGTH)
  return cleaned || undefined
}

const resolveResultsDirectory = (
  filesDirectory: string,
  consortiumId: string,
  runId: string,
  participantId?: string,
): string => {
  if (participantId) {
    const participantResultsPath = path.join(
      filesDirectory,
      consortiumId,
      runId,
      participantId,
      'results',
    )

    if (fs.existsSync(participantResultsPath)) {
      return participantResultsPath
    }
  }

  return path.join(filesDirectory, consortiumId, runId, 'results')
}

const walkDirectory = (
  dirPath: string,
  baseUrl: string,
  rootPath: string,
): FileInfo[] => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  let results: FileInfo[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const stat = fs.lstatSync(fullPath)
    const relativePath = path.relative(rootPath, fullPath) // key fix here

    const fileInfo: FileInfo = {
      name: entry.name,
      path: fullPath,
      size: stat.size,
      isDirectory: entry.isDirectory(),
      lastModified: stat.mtime,
      url: path.join(baseUrl, relativePath).replace(/\\/g, '/'), // consistent relative path
    }

    results.push(fileInfo)

    if (entry.isDirectory()) {
      const subResults = walkDirectory(fullPath, baseUrl, rootPath)
      results = results.concat(subResults)
    }
  }

  return results
}

export const listRunFiles = async (req: Request, res: Response) => {
  try {
    const { pathBaseDirectory: filesDirectory } = await getConfig()
    const { consortiumId, runId, participantId: routeParticipantId } = req.params
    const participantId = (
      routeParticipantId ??
      (req as any).user?.participantId ??
      (req as any).user?.userId
    ) as string | undefined
    const directoryPath = resolveResultsDirectory(
      filesDirectory,
      consortiumId,
      runId,
      participantId,
    )

    if (!fs.existsSync(directoryPath)) {
      logger.warn(`Directory not found: ${directoryPath}`)
      return res.status(404).json({ error: 'Run directory not found' })
    }

    const baseUrl = participantId
      ? `${consortiumId}/${runId}/${participantId}`
      : `${consortiumId}/${runId}`
    const rootPath = directoryPath
    const fileList = walkDirectory(directoryPath, baseUrl, rootPath)

    res.json(fileList)
  } catch (error) {
    logger.error(`Error in listRunFiles: ${(error as Error).message}`)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export const getRunError = async (req: Request, res: Response) => {
  try {
    const { pathBaseDirectory: filesDirectory } = await getConfig()
    const { consortiumId, runId, participantId: routeParticipantId } = req.params
    const participantId = (
      routeParticipantId ??
      (req as any).user?.participantId ??
      (req as any).user?.userId
    ) as string | undefined
    const resultsDirectory = resolveResultsDirectory(
      filesDirectory,
      consortiumId,
      runId,
      participantId,
    )
    const markerPath = path.join(resultsDirectory, '.neuroflame_error.json')

    const rawMarker = await readMarker(markerPath)
    if (rawMarker === undefined) {
      return res.status(404).json({ error: 'No local computation error found' })
    }

    const marker = JSON.parse(rawMarker) as TerminalErrorMarker
    const message = cleanErrorField(marker.message)
    if (!message) {
      return res.status(422).json({ error: 'Invalid local computation error' })
    }

    return res.json({
      origin: cleanErrorField(marker.origin),
      stage: cleanErrorField(marker.stage),
      scope: cleanErrorField(marker.scope),
      errorType: cleanErrorField(marker.error_type),
      message,
    })
  } catch (error) {
    logger.error(`Error in getRunError: ${(error as Error).message}`)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

export const serveRunFile = async (req: Request, res: Response) => {
  try {
    const { pathBaseDirectory: filesDirectory } = await getConfig()
    const { consortiumId, runId, participantId: routeParticipantId } = req.params
    const participantId = (
      routeParticipantId ??
      (req as any).user?.participantId ??
      (req as any).user?.userId
    ) as string | undefined
    const filePathParam = req.params[0] // catch-all route segment

    const baseDirectory = resolveResultsDirectory(
      filesDirectory,
      consortiumId,
      runId,
      participantId,
    )
    const resolvedBase = path.resolve(baseDirectory)
    const resolvedFile = path.resolve(baseDirectory, filePathParam)

    // Ensure path is within allowed directory
    if (resolvedFile !== resolvedBase && !resolvedFile.startsWith(`${resolvedBase}${path.sep}`)) {
      logger.warn(`Unauthorized path access attempt: ${resolvedFile}`)
      return res.status(403).json({ error: 'Unauthorized access' })
    }

    // Fail fast if it doesn't exist, or a symlink leads outside the results directory
    const realFile = await realPathWithin(resolvedBase, resolvedFile)
    if (!realFile) {
      logger.warn(`File not found: ${resolvedFile}`)
      return res.status(404).send('File not found')
    }

    const stat = fs.lstatSync(realFile)

    // ✅ Handle directories
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(realFile, { withFileTypes: true })

      const directoryContents: FileInfo[] = entries.map((entry) => {
        // URLs follow the requested path; filesystem access uses the resolved one.
        const entryPath = path.join(resolvedFile, entry.name)
        const entryStat = fs.lstatSync(path.join(realFile, entry.name))
        const relativeUrl = path.relative(
          baseDirectory,
          entryPath,
        )

        return {
          name: entry.name,
          path: entryPath,
          size: entryStat.size,
          isDirectory: entry.isDirectory(),
          lastModified: entryStat.mtime,
          url: `${participantId ? `${consortiumId}/${runId}/${participantId}` : `${consortiumId}/${runId}`}/${relativeUrl}`.replace(/\\/g, '/'),
        }
      })

      return res.json(directoryContents)
    }

    // ✅ Handle .html files
    if (stat.isFile() && resolvedFile.endsWith('.html')) {
      let contents = fs.readFileSync(realFile, 'utf8')

      if (!contents.includes('<base')) {
        contents = contents.replace('<head>', '<head><base href="./">')
      }

      res.setHeader('Content-Type', 'text/html')
      return res.send(contents)
    }

    // ✅ Serve other files
    if (stat.isFile()) {
      return res.sendFile(realFile)
    }

    logger.warn(`Unsupported file type at path: ${resolvedFile}`)
    return res.status(400).send('Unsupported file type')
  } catch (error) {
    logger.error(`Error in serveRunFile: ${(error as Error).message}`)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

export const serveRunFolder = async (req: Request, res: Response) => {
  try {
    const { pathBaseDirectory: filesDirectory } = await getConfig()
    const { consortiumId, runId, participantId: routeParticipantId } = req.params
    const participantId = (
      routeParticipantId ??
      (req as any).user?.participantId ??
      (req as any).user?.userId
    ) as string | undefined
    const directoryPath = resolveResultsDirectory(
      filesDirectory,
      consortiumId,
      runId,
      participantId,
    )

    if (!fs.existsSync(directoryPath)) {
      logger.warn(`Directory not found: ${directoryPath}`)
      return res.status(404).json({ error: 'Run directory not found' })
    }
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename=${runId}_results.zip`)

    const archive = archiver('zip', {
      zlib: { level: 9 },
    })

    archive.on('error', (err) => {
      logger.error(`Archive error: ${err.message}`)
      res.status(500).end()
    })

    archive.pipe(res)
    archive.directory(directoryPath, false)
    archive.finalize()
  } catch (error) {
    logger.error(`Error in serveRunFolder: ${(error as Error).message}`)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
