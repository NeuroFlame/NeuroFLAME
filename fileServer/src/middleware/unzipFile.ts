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

  // Extract beside the target and swap it in, so a failed or repeated upload
  // never leaves participants with a partial set of kits.
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
    await fs.rm(targetDir, { recursive: true, force: true })
    await fs.rename(staging, targetDir)
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
  } else {
    res.status(500).send('Failed to store run kits')
  }
}
