import path from 'path'
import { createWriteStream } from 'fs'
import fs from 'fs/promises'
import { pipeline } from 'stream/promises'
import unzipper from 'unzipper'
import { Request, Response, NextFunction } from 'express'
import { BASE_DIR } from '../config.js'
import { logger } from '../logger.js'

// The upload is a flat archive of one <participantId>.zip per participant kit.
const KIT_ENTRY = /^[A-Za-z0-9_-]{1,128}\.zip$/

export class InvalidRunKitArchive extends Error {}
export class RunKitsAlreadyPublished extends Error {}

export async function extractRunKits(zipPath: string, targetDir: string): Promise<void> {
  const archive = await unzipper.Open.file(zipPath)
  const names = new Set<string>()
  for (const entry of archive.files) {
    if (entry.type !== 'File' || !KIT_ENTRY.test(entry.path) || names.has(entry.path)) {
      throw new InvalidRunKitArchive('Run kit archive may only contain participant kit files')
    }
    names.add(entry.path)
  }
  if (names.size === 0) throw new InvalidRunKitArchive('Run kit archive is empty')

  // Extract beside the target and publish with one rename. Central uploads each
  // run's kits once, so kits already published are never replaced: participants
  // may be downloading them, and the first of two concurrent uploads wins.
  const parent = path.dirname(targetDir)
  await fs.mkdir(parent, { recursive: true, mode: 0o700 })
  const staging = await fs.mkdtemp(path.join(parent, '.staging-'))
  try {
    for (const entry of archive.files) {
      await pipeline(
        entry.stream(),
        createWriteStream(path.join(staging, entry.path), { flags: 'wx', mode: 0o600 }),
      )
    }
    try {
      await fs.rename(staging, targetDir)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOTEMPTY' || code === 'EEXIST') {
        throw new RunKitsAlreadyPublished('Run kits for this run are already published')
      }
      throw error
    }
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true })
    throw error
  }
}

export const unzipFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const zipPath = req.file!.path
  const { consortiumId, runId } = req.params
  let failure: unknown
  try {
    await extractRunKits(zipPath, path.join(BASE_DIR, consortiumId, runId))
  } catch (error) {
    failure = error
  }
  // Remove the upload before responding so it never outlives the request.
  try {
    await fs.rm(zipPath, { force: true })
  } catch (error) {
    logger.error(`Failed to remove uploaded archive: ${(error as Error).message}`)
  }

  if (failure === undefined) {
    logger.info(`Stored run kits for run ${runId}`)
    next()
    return
  }
  logger.error(`Error extracting run kits for run ${runId}: ${(failure as Error).message}`)
  if (failure instanceof InvalidRunKitArchive) {
    res.status(400).send('Invalid run kit archive')
  } else if (failure instanceof RunKitsAlreadyPublished) {
    res.status(409).send('Run kits for this run are already published')
  } else {
    res.status(500).send('Failed to store run kits')
  }
}
