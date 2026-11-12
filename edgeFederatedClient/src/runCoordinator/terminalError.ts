import { constants as fsConstants, promises as fs } from 'fs'
import path from 'path'

const TERMINAL_ERROR_FILE = '.neuroflame_error.json'
const MAX_LOCAL_ERROR_LENGTH = 4000
// O_NOFOLLOW is unavailable on Windows; O_EXCL still refuses an existing link there.
const CREATE_NEW_FILE = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
  (fsConstants.O_NOFOLLOW ?? 0)

export const ensureLocalRuntimeError = async (
  outputDirectory: string,
  stage: string,
  message: string,
): Promise<void> => {
  const markerPath = path.join(outputDirectory, TERMINAL_ERROR_FILE)
  await fs.mkdir(outputDirectory, { recursive: true, mode: 0o700 })

  // The computation can write this directory, so the marker may be a planted link
  // pointing at a host file. Keep a real marker; replace a link; never follow one.
  try {
    const existing = await fs.lstat(markerPath)
    if (!existing.isSymbolicLink()) return
    await fs.unlink(markerPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  let handle: Awaited<ReturnType<typeof fs.open>>
  try {
    handle = await fs.open(markerPath, CREATE_NEW_FILE, 0o600)
  } catch (error) {
    // Another writer created the marker first; the earliest record wins.
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return
    throw error
  }
  try {
    await handle.writeFile(
      JSON.stringify(
        {
          schema_version: 1,
          origin: 'site',
          stage,
          scope: 'site runtime',
          error_type: 'RuntimeError',
          message: message.trim().slice(0, MAX_LOCAL_ERROR_LENGTH),
          traceback: '',
        },
        null,
        2,
      ),
      'utf8',
    )
  } finally {
    await handle.close()
  }
}
