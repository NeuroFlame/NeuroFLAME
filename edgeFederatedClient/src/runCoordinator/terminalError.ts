import { promises as fs } from 'fs'
import path from 'path'

const TERMINAL_ERROR_FILE = '.neuroflame_error.json'
const MAX_LOCAL_ERROR_LENGTH = 4000

export const ensureLocalRuntimeError = async (
  outputDirectory: string,
  stage: string,
  message: string,
): Promise<void> => {
  const markerPath = path.join(outputDirectory, TERMINAL_ERROR_FILE)
  try {
    await fs.access(markerPath)
    return
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  await fs.mkdir(outputDirectory, { recursive: true, mode: 0o700 })
  await fs.writeFile(
    markerPath,
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
    { encoding: 'utf8', mode: 0o600 },
  )
}
