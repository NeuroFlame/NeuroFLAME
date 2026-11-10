import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { crc32 } from 'node:zlib'
import { after, test } from 'node:test'

const consortiumId = 'a'.repeat(24)
const runId = 'b'.repeat(24)
const participants = ['c'.repeat(24), 'd'.repeat(24)]
const tokens = {
  central: { userId: 'e'.repeat(24), roles: ['central'] },
  user: { userId: participants[0], roles: ['user'] },
  ...Object.fromEntries(participants.map((participantId) => [participantId, { participantId, runId, consortiumId }])),
}

const root = await mkdtemp(path.join(tmpdir(), 'nf-file-server-'))
const baseDir = path.join(root, 'fileServer')
const servers = []
const listen = async (server) => {
  servers.push(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}`
}
after(async () => {
  for (const server of servers) {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
  await rm(root, { recursive: true, force: true })
})

// Stands in for the central API /authenticateToken endpoint.
const authUrl = await listen(createServer((request, response) => {
  let body = ''
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => {
    const decoded = tokens[JSON.parse(body).token]
    response.statusCode = decoded ? 200 : 401
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(decoded ? { decodedAccessToken: decoded } : {}))
  })
}))
// Configuration is read at import time.
Object.assign(process.env, {
  AUTHENTICATION_URL: `${authUrl}/`,
  FILE_SERVER_BASE_DIR: baseDir,
  FILE_SERVER_PORT: '1',
})
const { createApp } = await import('../dist/app.js')
const { removeExpiredRunKits } = await import('../dist/runKitRetention.js')
const fileServerUrl = await listen(createServer(createApp()))

// Builds a stored (uncompressed) zip so the test can use entry names archive tools refuse to write.
const makeZip = (entries) => {
  const local = []
  const central = []
  let offset = 0
  for (const [name, content] of entries) {
    const nameBuffer = Buffer.from(name)
    const data = Buffer.from(content)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt32LE(crc32(data), 14)
    header.writeUInt32LE(data.length, 18)
    header.writeUInt32LE(data.length, 22)
    header.writeUInt16LE(nameBuffer.length, 26)
    const record = Buffer.alloc(46)
    record.writeUInt32LE(0x02014b50, 0)
    record.writeUInt16LE(20, 4)
    record.writeUInt16LE(20, 6)
    record.writeUInt32LE(crc32(data), 16)
    record.writeUInt32LE(data.length, 20)
    record.writeUInt32LE(data.length, 24)
    record.writeUInt16LE(nameBuffer.length, 28)
    record.writeUInt32LE(offset, 42)
    local.push(header, nameBuffer, data)
    central.push(record, nameBuffer)
    offset += header.length + nameBuffer.length + data.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, end])
}

const upload = (target, zip, { token = 'central', filename = 'kits.zip' } = {}) => {
  const form = new FormData()
  form.append('file', new Blob([zip]), filename)
  return fetch(`${fileServerUrl}/upload/${target}`, { method: 'POST', headers: { 'x-access-token': token }, body: form })
}

// Exercises the run kit boundary as one unit: the central client's packaging and
// upload, this file server, and the edge client's download and extraction.
const centralDist = new URL('../../centralFederatedClient/dist/', import.meta.url)
const edgeDist = new URL('../../edgeFederatedClient/dist/', import.meta.url)
const skip = !(existsSync(centralDist) && existsSync(edgeDist)) && 'build the central and edge clients first'

test('participant kits travel from central provisioning to the edge intact', { skip }, async () => {
  Object.assign(process.env, {
    HTTP_URL: 'http://127.0.0.1:9/graphql',
    WS_URL: 'ws://127.0.0.1:9/graphql',
    ACCESS_TOKEN: 'central',
    FILE_SERVER_URL: fileServerUrl,
    CENTRAL_BASE_DIR: path.join(root, 'central'),
    FQDN: 'localhost',
    HOSTING_PORT_START: '1',
    HOSTING_PORT_END: '2',
  })
  const runStart = 'runCoordinator/eventHandlers/runStart/'
  const { prepareHostingDirectory } = await import(new URL(`${runStart}provisionRun/prepareHostingDirectory.js`, centralDist))
  const { default: uploadToFileServer } = await import(new URL(`${runStart}uploadToFileServer.js`, centralDist))
  const { default: downloadFile } = await import(new URL(`${runStart}downloadFile.js`, edgeDist))
  const { unzipFile } = await import(new URL(`${runStart}unzipFile.js`, edgeDist))

  // Shaped like provisioning output: one folder per participant plus central's own kit.
  const pathRun = path.join(root, 'central', 'runs', consortiumId, runId)
  for (const id of [...participants, 'centralNode']) {
    await mkdir(path.join(pathRun, 'runKits', id, 'startup'), { recursive: true })
    await writeFile(path.join(pathRun, 'runKits', id, 'startup', 'client.key'), `key for ${id}`)
  }
  await prepareHostingDirectory({
    sourceDir: path.join(pathRun, 'runKits'),
    targetDir: path.join(pathRun, 'hosting'),
    exclude: ['centralNode'],
  })
  await uploadToFileServer({ consortiumId, runId, pathBaseDirectory: path.join(root, 'central') })

  // The upload archive is built outside hosting/, never included in itself, and removed after upload.
  assert.ok(!existsSync(path.join(pathRun, 'hosting.zip')))
  const kits = participants.map((id) => `${id}.zip`)
  assert.deepEqual((await readdir(path.join(baseDir, consortiumId, runId))).sort(), kits)
  assert.deepEqual(await readdir(path.join(baseDir, '.incoming')), [])

  for (const participantId of participants) {
    const runKitPath = path.join(root, 'edge', participantId, 'runKit')
    await downloadFile({
      url: `${fileServerUrl}/download/${consortiumId}/${runId}/${participantId}`,
      accessToken: participantId,
      pathOutputDir: runKitPath,
      outputFilename: 'kit.zip',
    })
    await unzipFile({ directory: runKitPath, fileName: 'kit.zip' })
    assert.equal(await readFile(path.join(runKitPath, 'startup', 'client.key'), 'utf8'), `key for ${participantId}`)
  }

  // One participant's download token cannot fetch another participant's kit.
  await assert.rejects(downloadFile({
    url: `${fileServerUrl}/download/${consortiumId}/${runId}/${participants[1]}`,
    accessToken: participants[0],
    pathOutputDir: path.join(root, 'edge', 'cross'),
    outputFilename: 'kit.zip',
  }), /status code 400/)
})

test('uploads are central-only, path-checked, and refuse archives that are not a flat set of kits', async () => {
  const consortium = 'f'.repeat(24)
  const kit = makeZip([[`${participants[0]}.zip`, 'kit']])
  assert.equal((await upload(`${consortium}/${runId}`, kit, { token: 'user' })).status, 403)
  for (const target of [`..%2F..%2Fescape/${runId}`, `${consortium}/..%2F${runId}`]) {
    assert.equal((await upload(target, kit)).status, 400, target)
  }
  for (const entries of [[['../escaped.zip', 'x']], [['nested/kit.zip', 'x']], [['/absolute.zip', 'x']], []]) {
    assert.equal((await upload(`${consortium}/${runId}`, makeZip(entries))).status, 400, JSON.stringify(entries))
  }
  // A client-chosen upload filename never decides where the upload lands.
  assert.equal((await upload(`${consortium}/${runId}`, kit, { filename: '../../escaped.zip' })).status, 200)
  const escapes = [path.join(root, 'escaped.zip'), path.join(baseDir, 'escaped.zip'), path.join(root, 'escape')]
  for (const escaped of escapes) {
    assert.ok(!existsSync(escaped), escaped)
  }
  assert.deepEqual(await readdir(path.join(baseDir, '.incoming')), [])
})

test('expired run kits, staging directories and incoming uploads are removed', async () => {
  const retention = path.join(root, 'retention')
  const now = Date.now()
  const old = new Date(now - 2 * 60 * 60 * 1000)
  const expired = [
    path.join(retention, consortiumId, runId),
    path.join(retention, consortiumId, '.staging-abc'),
    path.join(retention, '.incoming', 'upload'),
  ]
  const fresh = path.join(retention, consortiumId, 'f'.repeat(24))
  for (const dir of [expired[0], expired[1], path.dirname(expired[2]), fresh]) await mkdir(dir, { recursive: true })
  await writeFile(expired[2], 'partial upload')
  for (const target of expired) await utimes(target, old, old)

  await removeExpiredRunKits(retention, 60 * 60 * 1000, now)
  for (const target of expired) await assert.rejects(lstat(target), { code: 'ENOENT' }, target)
  assert.ok((await lstat(fresh)).isDirectory())
})
