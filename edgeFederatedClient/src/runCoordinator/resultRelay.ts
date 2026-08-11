import fs from 'fs/promises'
import type { FileHandle } from 'fs/promises'
import type { Dirent } from 'fs'
import { constants as fsConstants } from 'fs'
import path from 'path'
import { getConfig } from '../config/config.js'
import { logger } from '../logger.js'
import { validateToken } from '../auth/validateToken.js'

const MAX_TEXT_BYTES = 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_REPORT_IMAGES = 4
const MAX_LIST_ENTRIES = 500
const MAX_VISITED_NODES = 2_000
const MAX_LIST_DEPTH = 20
const MAX_LIST_ELAPSED_MS = 2_000
const PRIVATE_FILENAMES = new Set([
  '.neuroflame_error.json',
  'failed-container.log',
])
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.m', '.csv', '.json', '.html', '.htm'])
const IMAGE_MIME_TYPES: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

export interface ResultRelayRequest {
  requestId: string
  targetUserId: string
  consortiumId: string
  runId: string
  operation: 'report' | 'list' | 'read'
  relativePath?: string | null
  callbackUrl: string
  callbackToken: string
  expiresAt: string
}

type RelayBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }

const isPrivateEntry = (name: string): boolean =>
  name.startsWith('.') || PRIVATE_FILENAMES.has(name) || name.toLowerCase().endsWith('.log')

const inside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

interface BoundDirectory {
  lexicalPath: string
  expectedRealPath: string
  dev: number
  ino: number
  handle: FileHandle
}

const directoryFlags = (): number => {
  if (
    typeof fsConstants.O_NOFOLLOW !== 'number' ||
    fsConstants.O_NOFOLLOW === 0 ||
    typeof fsConstants.O_DIRECTORY !== 'number' ||
    fsConstants.O_DIRECTORY === 0
  ) throw new Error('Secure derivative result access is unsupported on this platform')
  return fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_DIRECTORY
}

const fileFlags = (): number => {
  if (
    typeof fsConstants.O_NOFOLLOW !== 'number' ||
    fsConstants.O_NOFOLLOW === 0 ||
    typeof fsConstants.O_NONBLOCK !== 'number' ||
    fsConstants.O_NONBLOCK === 0
  ) {
    throw new Error('Secure derivative result access is unsupported on this platform')
  }
  return fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK
}

const sameIdentity = (
  left: { dev: number; ino: number },
  right: { dev: number; ino: number },
): boolean => left.dev === right.dev && left.ino === right.ino

async function bindDirectories(
  root: string,
  segments: string[],
  expectedRoot?: { dev: number; ino: number },
): Promise<BoundDirectory[]> {
  const bound: BoundDirectory[] = []
  let lexicalPath = root
  let rootRealPath = ''
  try {
    for (let index = 0; index <= segments.length; index += 1) {
      if (index > 0) lexicalPath = path.join(lexicalPath, segments[index - 1])
      const handle = await fs.open(lexicalPath, directoryFlags())
      try {
        const [descriptorStat, lexicalStat, realPath] = await Promise.all([
          handle.stat(),
          fs.lstat(lexicalPath),
          fs.realpath(lexicalPath),
        ])
        if (
          !descriptorStat.isDirectory() ||
          lexicalStat.isSymbolicLink() ||
          !lexicalStat.isDirectory() ||
          !sameIdentity(descriptorStat, lexicalStat)
        ) throw new Error('Result path contains an unsafe directory')
        if (index === 0 && expectedRoot && !sameIdentity(descriptorStat, expectedRoot)) {
          throw new Error('Result root changed after validation')
        }
        if (index === 0) rootRealPath = realPath
        const expectedRealPath = index === 0
          ? rootRealPath
          : path.join(rootRealPath, ...segments.slice(0, index))
        if (realPath !== expectedRealPath) {
          throw new Error('Result path contains an indirect directory')
        }
        bound.push({
          lexicalPath,
          expectedRealPath,
          dev: descriptorStat.dev,
          ino: descriptorStat.ino,
          handle,
        })
      } catch (error) {
        await handle.close()
        throw error
      }
    }
    return bound
  } catch (error) {
    await Promise.all(bound.map(async (directory) => directory.handle.close()))
    throw error
  }
}

async function revalidateDirectories(bound: BoundDirectory[]): Promise<void> {
  for (const directory of bound) {
    const [descriptorStat, lexicalStat, realPath] = await Promise.all([
      directory.handle.stat(),
      fs.lstat(directory.lexicalPath),
      fs.realpath(directory.lexicalPath),
    ])
    if (
      lexicalStat.isSymbolicLink() ||
      !lexicalStat.isDirectory() ||
      !sameIdentity(directory, descriptorStat) ||
      !sameIdentity(directory, lexicalStat) ||
      realPath !== directory.expectedRealPath
    ) throw new Error('Result directory changed during validation')
  }
}

const closeDirectories = async (bound: BoundDirectory[]): Promise<void> => {
  await Promise.all(bound.map(async (directory) => directory.handle.close()))
}

const pathSegments = (relativePath: string): string[] => {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\0')) {
    throw new Error('Invalid derivative result path')
  }
  const segments = relativePath.split(/[\\/]+/)
  if (segments.some((segment) =>
    !segment || segment === '.' || segment === '..' || isPrivateEntry(segment),
  )) throw new Error('Invalid derivative result path')
  return segments
}

export async function resolveSafeEntry(root: string, relativePath: string): Promise<string> {
  const segments = pathSegments(relativePath)
  const directories = await bindDirectories(root, segments.slice(0, -1))
  try {
    const candidate = path.join(root, ...segments)
    const [stat, realCandidate] = await Promise.all([
      fs.lstat(candidate),
      fs.realpath(candidate),
    ])
    if (stat.isSymbolicLink()) throw new Error('Result symlinks are not supported')
    const expected = path.join(directories[0].expectedRealPath, ...segments)
    if (realCandidate !== expected || !inside(directories[0].expectedRealPath, realCandidate)) {
      throw new Error('Result path escapes its run directory')
    }
    await revalidateDirectories(directories)
    return realCandidate
  } finally {
    await closeDirectories(directories)
  }
}

export interface ValidatedResultRoot {
  path: string
  dev: number
  ino: number
}

export async function validateResultRoot(
  baseDirectory: string,
  root: string,
): Promise<ValidatedResultRoot> {
  const relativeRoot = path.relative(baseDirectory, root)
  if (!relativeRoot || relativeRoot.startsWith('..') || path.isAbsolute(relativeRoot)) {
    throw new Error('Invalid result directory')
  }
  const segments = relativeRoot.split(path.sep)
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Invalid result directory')
  }
  const directories = await bindDirectories(baseDirectory, segments)
  try {
    await revalidateDirectories(directories)
    const realRoot = directories.at(-1)?.expectedRealPath
    if (!realRoot || !inside(directories[0].expectedRealPath, realRoot)) {
      throw new Error('Result directory escapes local storage')
    }
    const rootDirectory = directories.at(-1)
    if (!rootDirectory) throw new Error('Invalid result directory')
    return { path: realRoot, dev: rootDirectory.dev, ino: rootDirectory.ino }
  } finally {
    await closeDirectories(directories)
  }
}

async function readBoundedFile(
  root: string,
  relativePath: string,
  maximumBytes: number,
  expectedRoot?: { dev: number; ino: number },
): Promise<Buffer> {
  const segments = pathSegments(relativePath)
  const directories = await bindDirectories(root, segments.slice(0, -1), expectedRoot)
  const filePath = path.join(root, ...segments)
  let handle: FileHandle | undefined
  try {
    handle = await fs.open(filePath, fileFlags())
    const descriptorStat = await handle.stat()
    if (!descriptorStat.isFile() || descriptorStat.size > maximumBytes) {
      throw new Error('Derivative result is too large or not a regular file')
    }
    const [currentPath, currentStat] = await Promise.all([
      fs.realpath(filePath),
      fs.lstat(filePath),
    ])
    const expectedPath = path.join(directories[0].expectedRealPath, ...segments)
    if (
      currentStat.isSymbolicLink() ||
      currentPath !== expectedPath ||
      !inside(directories[0].expectedRealPath, currentPath) ||
      !sameIdentity(currentStat, descriptorStat)
    ) throw new Error('Derivative result changed during validation')
    await revalidateDirectories(directories)

    const chunks: Buffer[] = []
    let total = 0
    while (total <= maximumBytes) {
      const buffer = Buffer.alloc(Math.min(64 * 1024, maximumBytes + 1 - total))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null)
      if (bytesRead === 0) break
      chunks.push(buffer.subarray(0, bytesRead))
      total += bytesRead
    }
    if (total > maximumBytes) throw new Error('Derivative result grew beyond its size limit')
    const finalPathStat = await fs.lstat(filePath)
    if (finalPathStat.isSymbolicLink() || !sameIdentity(finalPathStat, descriptorStat)) {
      throw new Error('Derivative result changed while being read')
    }
    await revalidateDirectories(directories)
    return Buffer.concat(chunks, total)
  } finally {
    if (handle) await handle.close()
    await closeDirectories(directories)
  }
}

async function inspectSafeFile(
  root: string,
  relativePath: string,
  maximumBytes: number,
  expectedRoot?: { dev: number; ino: number },
): Promise<number> {
  const segments = pathSegments(relativePath)
  const directories = await bindDirectories(root, segments.slice(0, -1), expectedRoot)
  const filePath = path.join(root, ...segments)
  let handle: FileHandle | undefined
  try {
    handle = await fs.open(filePath, fileFlags())
    const descriptorStat = await handle.stat()
    if (!descriptorStat.isFile() || descriptorStat.size > maximumBytes) {
      throw new Error('Derivative result is too large or not a regular file')
    }
    const [currentPath, currentStat] = await Promise.all([
      fs.realpath(filePath),
      fs.lstat(filePath),
    ])
    const expectedPath = path.join(directories[0].expectedRealPath, ...segments)
    if (
      currentStat.isSymbolicLink() ||
      currentPath !== expectedPath ||
      !sameIdentity(currentStat, descriptorStat)
    ) throw new Error('Derivative result changed during validation')
    await revalidateDirectories(directories)
    return descriptorStat.size
  } finally {
    if (handle) await handle.close()
    await closeDirectories(directories)
  }
}

const decodeHtml = (value: string): string => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))

export const htmlToInactiveText = (html: string): string => decodeHtml(
  html
    .replace(/<(script|style|template|noscript|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim(),
)

const extractImageSources = (html: string): string[] => {
  const sources: string[] = []
  const matcher = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi
  for (const match of html.matchAll(matcher)) {
    const source = match[1]?.trim()
    if (
      source &&
      !source.startsWith('data:') &&
      !source.startsWith('/') &&
      !/^[a-z][a-z0-9+.-]*:/i.test(source)
    ) {
      sources.push(source.split(/[?#]/)[0])
    }
    if (sources.length >= MAX_REPORT_IMAGES) break
  }
  return sources
}

async function readImage(
  root: string,
  relativePath: string,
  expectedRoot?: { dev: number; ino: number },
): Promise<RelayBlock> {
  const extension = path.extname(relativePath).toLowerCase()
  const mimeType = IMAGE_MIME_TYPES[extension]
  if (!mimeType) throw new Error('Unsupported image type')
  const data = await readBoundedFile(root, relativePath, MAX_IMAGE_BYTES, expectedRoot)
  const signatureValid =
    (mimeType === 'image/png' &&
      data.length >= 33 &&
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      data.subarray(12, 16).toString() === 'IHDR' &&
      data.subarray(-8, -4).toString() === 'IEND') ||
    (mimeType === 'image/jpeg' &&
      data.length >= 4 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data.at(-2) === 0xff &&
      data.at(-1) === 0xd9) ||
    (mimeType === 'image/webp' && data.length >= 16 &&
      data.subarray(0, 4).toString() === 'RIFF' &&
      data.subarray(8, 12).toString() === 'WEBP' &&
      data.readUInt32LE(4) + 8 === data.length &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(data.subarray(12, 16).toString()))
  if (!signatureValid) throw new Error('Image content does not match its type')
  return { type: 'image', data: data.toString('base64'), mimeType }
}

async function readText(
  root: string,
  relativePath: string,
  expectedRoot?: { dev: number; ino: number },
): Promise<RelayBlock> {
  const extension = path.extname(relativePath).toLowerCase()
  if (!TEXT_EXTENSIONS.has(extension)) throw new Error('Unsupported derivative result type')
  const contents = (await readBoundedFile(
    root,
    relativePath,
    MAX_TEXT_BYTES,
    expectedRoot,
  )).toString('utf8')
  if (contents.includes('\u0000')) throw new Error('Binary derivative content is not supported')
  return {
    type: 'text',
    text: extension === '.html' || extension === '.htm'
      ? htmlToInactiveText(contents)
      : contents,
  }
}

async function listFiles(
  root: string,
  expectedRoot?: { dev: number; ino: number },
): Promise<RelayBlock> {
  const entries: Array<{ path: string; type: 'file'; size: number }> = []
  const startedAt = Date.now()
  let visitedNodes = 0
  const consumeBudget = (): void => {
    visitedNodes += 1
    if (
      visitedNodes > MAX_VISITED_NODES ||
      Date.now() - startedAt > MAX_LIST_ELAPSED_MS
    ) throw new Error('Derivative result listing exceeded its work limit')
  }
  const visit = async (relativeDirectory = '', depth = 0): Promise<void> => {
    if (depth > MAX_LIST_DEPTH) {
      throw new Error('Derivative result listing exceeded its depth limit')
    }
    if (entries.length >= MAX_LIST_ENTRIES) return
    const directorySegments = relativeDirectory ? pathSegments(relativeDirectory) : []
    const bound = await bindDirectories(root, directorySegments, expectedRoot)
    const directory = relativeDirectory ? path.join(root, relativeDirectory) : root
    let directoryHandle: Awaited<ReturnType<typeof fs.opendir>> | undefined
    const directoryEntries: Dirent[] = []
    try {
      directoryHandle = await fs.opendir(directory)
      while (true) {
        const entry = await directoryHandle.read()
        if (!entry) break
        consumeBudget()
        directoryEntries.push(entry)
      }
      await revalidateDirectories(bound)
    } finally {
      if (directoryHandle) await directoryHandle.close().catch(() => undefined)
      await closeDirectories(bound)
    }
    for (const entry of directoryEntries) {
      if (entries.length >= MAX_LIST_ENTRIES) return
      if (isPrivateEntry(entry.name) || entry.isSymbolicLink()) continue
      const relativeEntry = path.join(relativeDirectory, entry.name)
      if (entry.isDirectory()) {
        await visit(relativeEntry, depth + 1)
        continue
      }
      const extension = path.extname(entry.name).toLowerCase()
      const maximumBytes = IMAGE_MIME_TYPES[extension] ? MAX_IMAGE_BYTES : MAX_TEXT_BYTES
      if (!entry.isFile() || (!TEXT_EXTENSIONS.has(extension) && !IMAGE_MIME_TYPES[extension])) continue
      let size: number
      try {
        size = await inspectSafeFile(root, relativeEntry, maximumBytes, expectedRoot)
      } catch { continue }
      entries.push({
        path: relativeEntry.split(path.sep).join('/'),
        type: 'file',
        size,
      })
    }
  }
  await visit()
  return { type: 'text', text: JSON.stringify(entries, null, 2) }
}

async function report(
  root: string,
  expectedRoot?: { dev: number; ino: number },
): Promise<RelayBlock[]> {
  const html = (await readBoundedFile(
    root,
    'index.html',
    MAX_TEXT_BYTES,
    expectedRoot,
  )).toString('utf8')
  const blocks: RelayBlock[] = [{ type: 'text', text: htmlToInactiveText(html) }]
  for (const source of extractImageSources(html)) {
    try {
      blocks.push(await readImage(root, source, expectedRoot))
    } catch {
      // A missing or unsupported figure must not hide the serialized report text.
    }
  }
  return blocks
}

export async function serializeDerivativeResult(
  root: string | ValidatedResultRoot,
  request: Pick<ResultRelayRequest, 'operation' | 'relativePath'>,
): Promise<{ blocks: RelayBlock[] }> {
  const rootPath = typeof root === 'string' ? root : root.path
  const expectedRoot = typeof root === 'string' ? undefined : { dev: root.dev, ino: root.ino }
  if (request.operation === 'report') return { blocks: await report(rootPath, expectedRoot) }
  if (request.operation === 'list') return { blocks: [await listFiles(rootPath, expectedRoot)] }
  if (!request.relativePath) throw new Error('A relative derivative result path is required')
  const extension = path.extname(request.relativePath).toLowerCase()
  const block = IMAGE_MIME_TYPES[extension]
    ? await readImage(rootPath, request.relativePath, expectedRoot)
    : await readText(rootPath, request.relativePath, expectedRoot)
  return { blocks: [block] }
}

async function sendResponse(
  request: ResultRelayRequest,
  response: { blocks: RelayBlock[] } | { error: 'unavailable' },
  sessionSignal?: AbortSignal,
): Promise<void> {
  const config = await getConfig()
  const expectedOrigin = new URL(config.httpUrl).origin
  const callback = new URL(request.callbackUrl)
  if (callback.origin !== expectedOrigin || callback.protocol !== new URL(config.httpUrl).protocol) {
    throw new Error('Invalid derivative result relay callback')
  }
  const result = await fetch(callback, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${request.callbackToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      operation: request.operation,
      relativePath: request.operation === 'read' ? request.relativePath : null,
      ...response,
    }),
    signal: sessionSignal
      ? AbortSignal.any([sessionSignal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
  })
  if (!result.ok && result.status !== 410) throw new Error('Derivative result callback failed')
}

export const MCP_RESULT_REQUEST_SUBSCRIPTION = `
  subscription McpResultRequest {
    mcpResultRequest {
      requestId
      targetUserId
      consortiumId
      runId
      operation
      relativePath
      callbackUrl
      callbackToken
      expiresAt
    }
  }
`

export function createResultRelayHandler({
  userId,
  accessToken,
  isActive = () => true,
  signal,
}: {
  userId: string
  accessToken: string
  isActive?: () => boolean
  signal?: AbortSignal
}) {
  return {
    next: async ({ data }: { data?: { mcpResultRequest?: ResultRelayRequest } }) => {
      const request = data?.mcpResultRequest
      if (!isActive() || !isResultRelayRequestForUser(request, userId)) return
      try {
        const config = await getConfig()
        const payload = await validateToken(accessToken)
        if (!payload.userId || payload.userId !== userId) {
          throw new Error('Desktop user is not authenticated')
        }
        if (!isActive()) throw new Error('Desktop session ended')
        const objectIdPattern = /^[a-f\d]{24}$/i
        if (
          !objectIdPattern.test(request.consortiumId) ||
          !objectIdPattern.test(request.runId) ||
          !objectIdPattern.test(payload.userId)
        ) {
          throw new Error('Invalid derivative result relay identifiers')
        }
        const root = path.join(
          config.pathBaseDirectory,
          request.consortiumId,
          request.runId,
          payload.userId,
          'results',
        )
        await sendResponse(
          request,
          await serializeDerivativeResult(
            await validateResultRoot(config.pathBaseDirectory, root),
            request,
          ),
          signal,
        )
        logger.info('Completed an MCP derivative result relay request', { requestId: request.requestId })
      } catch {
        logger.warn('Unable to complete an MCP derivative result relay request', { requestId: request.requestId })
        if (!isActive()) return
        try {
          await sendResponse(request, {
            error: 'unavailable',
          }, signal)
        } catch {
          // The central request may already have expired.
        }
      }
    },
    error: () => logger.warn('MCP derivative result relay subscription disconnected'),
    complete: () => logger.info('MCP derivative result relay subscription completed'),
  }
}

export function isResultRelayRequestForUser(
  request: ResultRelayRequest | undefined,
  userId: string,
  now = Date.now(),
): request is ResultRelayRequest {
  return Boolean(
    request &&
    request.targetUserId === userId &&
    Number(request.expiresAt) >= now,
  )
}
