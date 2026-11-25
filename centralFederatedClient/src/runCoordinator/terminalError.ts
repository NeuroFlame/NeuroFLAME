import { constants as fsConstants, promises as fs } from 'fs'
import path from 'path'

const TERMINAL_ERROR_FILE = '.neuroflame_error.json'
const ERROR_SCHEMA_VERSION = 1
const MAX_ERROR_FIELD_LENGTH = 2000
const MAX_MARKER_BYTES = 64 * 1024

// The computation writes the output directory and could plant a symlink to a host file.
const readMarkerFile = async (markerPath: string): Promise<string | undefined> => {
  const markerStats = await fs.lstat(markerPath)
  if (!markerStats.isFile() || markerStats.size > MAX_MARKER_BYTES) return undefined
  const handle = await fs.open(markerPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  try {
    const contents = await handle.readFile()
    return contents.byteLength > MAX_MARKER_BYTES ? undefined : contents.toString('utf8')
  } finally {
    await handle.close()
  }
}

export interface TerminalError {
  origin: 'site' | 'central' | 'unknown'
  stage?: string
  scope?: string
  errorType?: string
  message: string
  displayMessage: string
}

interface TerminalErrorMarker {
  schema_version?: unknown
  origin?: unknown
  stage?: unknown
  scope?: unknown
  error_type?: unknown
  message?: unknown
}

const cleanField = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const cleaned = value.trim().slice(0, MAX_ERROR_FIELD_LENGTH)
  return cleaned || undefined
}

export const readTerminalError = async (
  outputDirectory: string,
): Promise<TerminalError | undefined> => {
  try {
    const markerPath = path.join(outputDirectory, TERMINAL_ERROR_FILE)
    const rawMarker = await readMarkerFile(markerPath)
    if (rawMarker === undefined) {
      return undefined
    }
    const marker = JSON.parse(rawMarker) as TerminalErrorMarker
    const scope = cleanField(marker.scope)
    const stage = cleanField(marker.stage)
    const errorType = cleanField(marker.error_type)
    const message = cleanField(marker.message)

    if (!message) {
      return undefined
    }

    const origin = marker.schema_version === ERROR_SCHEMA_VERSION &&
      (marker.origin === 'site' || marker.origin === 'central')
      ? marker.origin
      : 'unknown'
    const context = [scope && `[${scope}]`, errorType && `${errorType}:`]
      .filter(Boolean)
      .join(' ')
    const displayMessage = origin === 'central'
      ? `Central computation failure: ${context ? `${context} ` : ''}${message}`
      : 'Central computation failed. Detailed error is available in the central run results.'

    return {
      origin,
      stage,
      scope,
      errorType,
      message,
      displayMessage,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}
