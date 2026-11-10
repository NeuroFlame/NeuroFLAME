import * as unzipper from 'unzipper'
import { constants, promises as fs } from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { logger } from '../../../logger.js'

type UnzipFileParams = {
  directory: string;
  fileName: string;
}

async function setPermissions(dir: string, mode: number): Promise<void> {
  await fs.chmod(dir, mode)
  const files = await fs.readdir(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const fileStat = await fs.lstat(filePath)

    if (fileStat.isDirectory()) {
      await setPermissions(filePath, mode)
    } else if (fileStat.isFile()) {
      await fs.chmod(filePath, filePath.endsWith('.sh') ? 0o700 : 0o600)
    }
  }
}

// Splits an archive entry name into path segments, refusing anything that
// could resolve outside the extraction directory on POSIX or Windows.
export function archiveEntrySegments(name: string): string[] {
  const segments = name.replace(/\/$/, '').split('/')
  if (
    name.includes('\\') ||
    name.includes('\0') ||
    segments.some((segment) => ['', '.', '..'].includes(segment) || segment.includes(':'))
  ) {
    throw new Error('Run kit archive contains an unsafe path')
  }
  return segments
}

// Creates each directory below root, refusing to pass through anything that
// is not a real directory (such as a link left in a reused run directory).
async function ensureDirectories(root: string, segments: string[]): Promise<string> {
  let current = root
  for (const segment of segments) {
    current = path.join(current, segment)
    try {
      await fs.mkdir(current, { mode: 0o700 })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    if (!(await fs.lstat(current)).isDirectory()) {
      throw new Error('Run kit archive path collides with a non-directory')
    }
  }
  return current
}

export async function unzipFile({
  directory,
  fileName,
}: UnzipFileParams): Promise<void> {
  const zipPath = path.join(directory, fileName)

  try {
    const fileStat = await fs.stat(zipPath)

    if (fileStat.size === 0) {
      throw new Error(`File ${zipPath} is empty.`)
    }
  } catch (err) {
    logger.error(`Error accessing file ${zipPath}: ${(err as Error).message}`)
    throw err
  }

  logger.info(`Starting to unzip file: ${zipPath}`)

  try {
    const archive = await unzipper.Open.file(zipPath)
    const entries = archive.files.map((entry) => ({
      entry,
      segments: archiveEntrySegments(entry.path),
      isDirectory: entry.type === 'Directory' || entry.path.endsWith('/'),
    }))
    if (entries.some(({ segments }) => segments.length === 1 && segments[0] === fileName)) {
      throw new Error('Run kit archive would overwrite itself')
    }

    for (const { entry, segments, isDirectory } of entries) {
      if (isDirectory) {
        await ensureDirectories(directory, segments)
        continue
      }
      const parent = await ensureDirectories(directory, segments.slice(0, -1))
      const target = path.join(parent, segments[segments.length - 1])
      const file = await fs.open(
        target,
        constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW ?? 0),
        0o600,
      )
      await pipeline(entry.stream(), file.createWriteStream())
    }
    logger.info(`Successfully unzipped file: ${zipPath}`)
  } catch (err) {
    logger.error(`Error unzipping file ${zipPath}: ${(err as Error).message}`)
    throw err
  }

  try {
    await setPermissions(directory, 0o700)
    logger.info(`Restricted extracted run-kit permissions in: ${directory}`)
  } catch (err) {
    logger.error(`Error setting file permissions: ${(err as Error).message}`)
    throw err
  }
}
