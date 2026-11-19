import fs from 'fs/promises'
import path from 'path'
import { logger } from './logger.js'

const removeIfOlder = async (target: string, cutoff: number): Promise<void> => {
  const stats = await fs.lstat(target)
  if (stats.mtimeMs < cutoff) {
    await fs.rm(target, { recursive: true, force: true })
    logger.info(`Removed expired run kit storage ${target}`)
  }
}

// Removes run kit directories, staging directories and incoming uploads that
// are older than the retention period. Every entry under the base directory is
// file server state, so anything expired is removed.
export async function removeExpiredRunKits(
  baseDir: string,
  maxAgeMs: number,
  now = Date.now(),
): Promise<void> {
  const cutoff = now - maxAgeMs
  let groups
  try {
    groups = await fs.readdir(baseDir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  for (const group of groups) {
    const groupPath = path.join(baseDir, group.name)
    if (!group.isDirectory()) {
      await removeIfOlder(groupPath, cutoff)
      continue
    }
    for (const entry of await fs.readdir(groupPath)) {
      await removeIfOlder(path.join(groupPath, entry), cutoff)
    }
  }
}

export function scheduleRunKitRetention(baseDir: string, maxAgeMs: number): NodeJS.Timeout {
  const sweep = () => removeExpiredRunKits(baseDir, maxAgeMs).catch((error) => {
    logger.error(`Run kit retention sweep failed: ${(error as Error).message}`)
  })
  sweep()
  const timer = setInterval(sweep, Math.min(maxAgeMs, 60 * 60 * 1000))
  timer.unref()
  return timer
}
