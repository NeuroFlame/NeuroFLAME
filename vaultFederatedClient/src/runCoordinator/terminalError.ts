import { constants as fsConstants, promises as fs } from 'fs'
import path from 'path'
import type { VaultErrorDisclosure } from '../errorDisclosure.js'

const TERMINAL_ERROR_FILE = '.neuroflame_error.json'
const ERROR_SCHEMA_VERSION = 1
const MAX_MARKER_BYTES = 64 * 1024
const MAX_STAGE_LENGTH = 128
const MAX_SCOPE_LENGTH = 512
const MAX_ERROR_TYPE_LENGTH = 256
const MAX_MESSAGE_LENGTH = 4000
const MAX_TRACEBACK_LENGTH = 12000
const ALLOWED_FIELDS = new Set([
  'schema_version',
  'origin',
  'stage',
  'scope',
  'error_type',
  'message',
  'traceback',
])

const UNSAFE_DETAIL_PATTERNS = [
  /authorization\s*:/i,
  /proxy-authorization\s*:/i,
  /\bbearer\s+[a-z0-9._~+/=-]{8,}/i,
  /\b(?:access[_-]?token|refresh[_-]?token|api[_-]?key|password|passwd|client[_-]?secret|credential)\s*[:=]\s*\S+/i,
  /\bVAULT_ACCESS_TOKEN\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
  /https?:\/\/[^\s/:]+:[^\s/@]+@/i,
  /(?:^|[\s,{])(?:[A-Z][A-Z0-9_]{2,})\s*=\s*[^\s,}]+/,
  /(?:^|\n)\s*(?:env|environment)\s*=\s*\{/i,
]

interface TerminalErrorMarker {
  schema_version: number
  origin: 'site'
  stage: string
  scope: string
  error_type: string
  message: string
  traceback: string
}

const boundedString = (
  value: unknown,
  maximumLength: number,
  allowEmpty = false,
): string | undefined => {
  if (typeof value !== 'string' || value.length > maximumLength || value.includes('\0')) {
    return undefined
  }
  const trimmed = value.trim()
  if (!allowEmpty && trimmed.length === 0) {
    return undefined
  }
  return trimmed
}

const parseMarker = (rawMarker: string): TerminalErrorMarker | undefined => {
  let value: unknown
  try {
    value = JSON.parse(rawMarker)
  } catch {
    return undefined
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const marker = value as Record<string, unknown>
  if (Object.keys(marker).some((field) => !ALLOWED_FIELDS.has(field))) {
    return undefined
  }

  const stage = boundedString(marker.stage, MAX_STAGE_LENGTH)
  const scope = boundedString(marker.scope, MAX_SCOPE_LENGTH)
  const errorType = boundedString(marker.error_type, MAX_ERROR_TYPE_LENGTH)
  const message = boundedString(marker.message, MAX_MESSAGE_LENGTH)
  const traceback = boundedString(marker.traceback, MAX_TRACEBACK_LENGTH, true)
  if (
    marker.schema_version !== ERROR_SCHEMA_VERSION ||
    marker.origin !== 'site' ||
    stage === undefined ||
    scope === undefined ||
    errorType === undefined ||
    message === undefined ||
    traceback === undefined
  ) {
    return undefined
  }

  const detail = `${scope}\n${errorType}\n${message}\n${traceback}`
  if (UNSAFE_DETAIL_PATTERNS.some((pattern) => pattern.test(detail))) {
    return undefined
  }

  return {
    schema_version: ERROR_SCHEMA_VERSION,
    origin: 'site',
    stage,
    scope,
    error_type: errorType,
    message,
    traceback,
  }
}

export const readDetailedTerminalError = async (
  outputDirectory: string,
): Promise<string | undefined> => {
  const markerPath = path.join(path.resolve(outputDirectory), TERMINAL_ERROR_FILE)
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined
  try {
    const markerStats = await fs.lstat(markerPath)
    if (!markerStats.isFile() || markerStats.isSymbolicLink() || markerStats.size > MAX_MARKER_BYTES) {
      return undefined
    }

    handle = await fs.open(markerPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
    const openStats = await handle.stat()
    if (!openStats.isFile() || openStats.size > MAX_MARKER_BYTES) {
      return undefined
    }
    const markerContents = await handle.readFile()
    if (markerContents.byteLength > MAX_MARKER_BYTES) {
      return undefined
    }
    const marker = parseMarker(markerContents.toString('utf8'))
    if (!marker) {
      return undefined
    }

    const context = `[${marker.scope}] ${marker.error_type}: ${marker.message}`
    return marker.traceback
      ? `Hosted vault disclosed computation failure: ${context}\n${marker.traceback}`
      : `Hosted vault disclosed computation failure: ${context}`
  } catch {
    return undefined
  } finally {
    try {
      await handle?.close()
    } catch {
      // Closing a rejected marker must not replace the generic run error.
    }
  }
}

export const resolveContainerFailureReport = async ({
  outputDirectory,
  disclosure,
  genericError,
}: {
  outputDirectory: string
  disclosure: VaultErrorDisclosure
  genericError: string
}): Promise<{ errorMessage: string; redactErrorDetails: boolean }> => {
  if (disclosure !== 'detailed') {
    return { errorMessage: genericError, redactErrorDetails: true }
  }
  const detailedError = await readDetailedTerminalError(outputDirectory)
  return detailedError
    ? { errorMessage: detailedError, redactErrorDetails: false }
    : { errorMessage: genericError, redactErrorDetails: true }
}
