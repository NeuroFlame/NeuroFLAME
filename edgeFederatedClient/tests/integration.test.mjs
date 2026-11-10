import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { access, chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { crc32 } from 'node:zlib'
import { after, before, test } from 'node:test'
import Docker from 'dockerode'
import { WebSocket } from 'ws'
import { setConfig } from '../dist/config/config.js'
import { start } from '../dist/api/index.js'
import { prepareComputationImage } from '../dist/runCoordinator/computationImage.js'
import { launchNode } from '../dist/runCoordinator/nodeManager/launchNode.js'
import { ensureLocalRuntimeError } from '../dist/runCoordinator/terminalError.js'
import downloadFile from '../dist/runCoordinator/eventHandlers/runStart/downloadFile.js'
import { unzipFile } from '../dist/runCoordinator/eventHandlers/runStart/unzipFile.js'

const localApiKey = 'k'.repeat(43)
const consortiumId = 'a'.repeat(24)
const runId = 'b'.repeat(24)
const participantId = 'c'.repeat(24)
const tokens = {
  user: { userId: participantId, roles: ['user'] },
  // A valid central token that belongs to no user, such as a kit download token.
  download: { participantId, runId, consortiumId },
}
let base, runPath, labelsFile, originalPath, authServer, edgeServer, edge, stubServer, stub

// Any local image with `sh`; Docker must be running.
const dockerImage = process.env.EDGE_DOCKER_TEST_IMAGE ?? 'mongo:7.0'
const dockerAvailable = await new Docker().getImage(dockerImage).inspect().then(() => true, () => false)

const listen = async (server) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${server.address().port}`
}

before(async () => {
  base = await mkdtemp(path.join(tmpdir(), 'nf-edge-'))
  runPath = path.join(base, consortiumId, runId, participantId)
  await mkdir(path.join(runPath, 'results'), { recursive: true })
  await mkdir(path.join(runPath, 'runKit'), { recursive: true })
  await writeFile(path.join(runPath, 'results', 'summary.txt'), 'public result')
  await writeFile(path.join(runPath, 'runKit', 'client.key'), 'private key')
  await writeFile(path.join(base, consortiumId, 'mount_config.json'), '{"dataPath":"/private/data"}')
  // A link a computation could plant in its writable results directory.
  await mkdir(path.join(base, 'outside'))
  await writeFile(path.join(base, 'outside', 'host.txt'), 'host secret')
  await symlink(path.join(base, 'outside'), path.join(runPath, 'results', 'escape'))

  // Stands in for `singularity inspect --labels --json` and `singularity pull`.
  const bin = path.join(base, 'bin')
  labelsFile = path.join(base, 'labels.json')
  await mkdir(bin)
  await writeFile(path.join(bin, 'singularity'), `#!/bin/sh
case "$1" in
  inspect) cat "${labelsFile}" ;;
  pull) printf 'sif' > "$2" ;;
  *) exit 1 ;;
esac
`)
  await chmod(path.join(bin, 'singularity'), 0o755)
  originalPath = process.env.PATH
  process.env.PATH = `${bin}${path.delimiter}${originalPath}`

  // Stands in for the central API token endpoint.
  authServer = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => {
      const decoded = tokens[JSON.parse(body).token]
      response.statusCode = decoded ? 200 : 401
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify(decoded ? { decodedAccessToken: decoded } : {}))
    })
  })
  setConfig({
    httpUrl: 'http://127.0.0.1:9/graphql',
    wsUrl: 'ws://127.0.0.1:9/graphql',
    pathBaseDirectory: base,
    authenticationEndpoint: `${await listen(authServer)}/`,
    hostingPort: 0,
    localApiKey,
  })
  edgeServer = await start({ port: 0, localApiKey })
  edge = `http://127.0.0.1:${edgeServer.address().port}`

  // Stands in for the file server: a complete kit, a stall and a dropped connection.
  stubServer = createServer((request, response) => {
    if (request.url === '/stalled') {
      response.setHeader('content-length', 100)
      response.write('partial')
    } else if (request.url === '/dropped') {
      response.setHeader('content-length', 100)
      response.write('partial', () => response.socket.destroy())
    }
  })
  stub = await listen(stubServer)
})

after(async () => {
  process.env.PATH = originalPath
  for (const server of [edgeServer, authServer, stubServer]) {
    server?.closeAllConnections()
    await new Promise((resolve) => server ? server.close(resolve) : resolve())
  }
  await rm(base, { recursive: true, force: true })
})

const withKey = (headers = {}) => ({ ...headers, 'x-neuroflame-local-key': localApiKey })
const graphql = (query, headers) => fetch(`${edge}/graphql`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify({ query }),
})

test('the local API listens on loopback and refuses requests without the local key', async () => {
  assert.equal(edgeServer.address().address, '127.0.0.1')
  const resultsUrl = `${edge}/run-results/${consortiumId}/${runId}/${participantId}/summary.txt`
  assert.equal((await fetch(resultsUrl)).status, 403)
  const mutation = `mutation { setMountDir(consortiumId: "${consortiumId}", mountDir: "/attacker") }`
  assert.equal((await graphql(mutation, { 'x-access-token': 'user' })).status, 403)
  const socketStatus = await new Promise((resolve) => {
    const socket = new WebSocket(`${edge.replace('http', 'ws')}/graphql`, 'graphql-transport-ws')
    socket.once('unexpected-response', (_request, response) => resolve(response.statusCode))
    socket.once('open', () => { socket.close(); resolve('open') })
  })
  assert.equal(socketStatus, 401)
  assert.equal(await (await fetch(resultsUrl, { headers: withKey() })).text(), 'public result')
})

test('results never serve run kits, consortium config, traversal or symlink escapes', async () => {
  const results = `${edge}/run-results/${consortiumId}/${runId}/${participantId}`
  for (const url of [
    `${results}/../runKit/client.key`,
    `${results}/%2E%2E%2FrunKit%2Fclient.key`,
    `${edge}/run-results/${consortiumId}/mount_config.json`,
    `${results}/escape/host.txt`,
  ]) {
    const response = await fetch(url, { headers: withKey() })
    const body = await response.text()
    assert.notEqual(response.status, 200, url)
    for (const secret of ['private key', '/private/data', 'host secret']) assert.ok(!body.includes(secret), url)
  }
})

test('mount changes require a signed-in user and a valid consortium id', async () => {
  const run = async (query, token) => (await (await graphql(query, withKey({ 'x-access-token': token }))).json())
  const setMount = (id) => `mutation { setMountDir(consortiumId: "${id}", mountDir: "/data") }`
  assert.match((await run(setMount(consortiumId), 'download')).errors[0].message, /Not authorized/)
  assert.match((await run(setMount('../../outside'), 'user')).errors[0].message, /Invalid consortium id/)
  assert.equal((await run(setMount(consortiumId), 'user')).data.setMountDir, true)
})

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

test('a stalled or dropped kit download fails instead of hanging and leaves no file', async () => {
  for (const name of ['stalled', 'dropped']) {
    const dir = path.join(base, `download-${name}`)
    await assert.rejects(downloadFile({
      url: `${stub}/${name}`, accessToken: 't', pathOutputDir: dir, outputFilename: 'kit.zip', idleTimeoutMs: 300,
    }), /Download failed/)
    await assert.rejects(lstat(path.join(dir, 'kit.zip')), { code: 'ENOENT' }, name)
  }
})

test('kit extraction refuses entries that would leave the run kit directory', async () => {
  for (const [index, name] of ['../escaped.txt', 'startup/../../escaped.txt', '/tmp/absolute.txt'].entries()) {
    const dir = path.join(base, `extract-${index}`)
    await mkdir(dir)
    await writeFile(path.join(dir, 'kit.zip'), makeZip([['startup/client.key', 'key'], [name, 'escaped']]))
    await assert.rejects(unzipFile({ directory: dir, fileName: 'kit.zip' }), /unsafe path/, name)
  }
  await assert.rejects(lstat(path.join(base, 'escaped.txt')), { code: 'ENOENT' })
})

const metadata = {
  title: 'Computation',
  computationVersion: '1.0.0',
  revision: 'abcdef1',
  source: 'https://example.test/computation',
  computationApiVersion: '0.1.0',
  boilerplateVersion: '0.1.0',
  nvflareVersion: '2.8.0',
}
const digest = `sha256:${'e'.repeat(64)}`
const resolvedImage = { sourceImage: 'example/computation:1', reference: `example/computation@${digest}`, digest, metadata }
const labels = (overrides = {}) => ({
  'org.opencontainers.image.title': ` ${metadata.title} `,
  'org.opencontainers.image.version': metadata.computationVersion,
  'org.opencontainers.image.revision': metadata.revision,
  'org.opencontainers.image.source': metadata.source,
  'org.neuroflame.computation-api.version': metadata.computationApiVersion,
  'org.neuroflame.boilerplate.version': metadata.boilerplateVersion,
  'org.neuroflame.nvflare.version': metadata.nvflareVersion,
  ...overrides,
})
const setLabels = (value) => writeFile(labelsFile, JSON.stringify({ data: { attributes: { labels: value } } }))

test('Singularity images are label-checked, cached privately, and only launched from the cache', async () => {
  const cached = path.join(base, 'singularityImages', `example_computation_1-${'e'.repeat(12)}.sif`)
  await setLabels(labels({ 'org.opencontainers.image.revision': 'different' }))
  await assert.rejects(prepareComputationImage(resolvedImage, 'singularity', base), /revision.*does not match/)
  await assert.rejects(access(cached), { code: 'ENOENT' })

  // Labels are compared after trimming, as central records them.
  await setLabels(labels())
  assert.equal(await prepareComputationImage(resolvedImage, 'singularity', base), cached)

  const lookalike = path.join(tmpdir(), 'example_computation_1-lookalike.sif')
  await writeFile(lookalike, 'sif')
  try {
    await assert.rejects(launchNode({
      containerService: 'singularity',
      imageName: lookalike,
      directoriesToMount: [],
      portBindings: [],
      commandsToRun: [],
    }), /not a prepared image in the private image cache/)
  } finally {
    await rm(lookalike, { force: true })
  }
})

test('the local error marker replaces a planted link instead of writing through it', async () => {
  const results = path.join(base, 'marker-results')
  await mkdir(results)
  const hostFile = path.join(base, 'host-file')
  await writeFile(hostFile, 'original host contents')
  await symlink(hostFile, path.join(results, '.neuroflame_error.json'))
  await ensureLocalRuntimeError(results, 'container_runtime', 'container exited with code 1')
  assert.equal(await readFile(hostFile, 'utf8'), 'original host contents')
  assert.ok((await lstat(path.join(results, '.neuroflame_error.json'))).isFile())
})

test('a dataset path containing "," and ":" mounts as one read-only directory', {
  skip: !dockerAvailable && `needs Docker and ${dockerImage}`,
  timeout: 60000,
}, async () => {
  const mounts = path.join(base, 'mounts')
  // Under the old Binds string this was an invalid or split volume spec.
  const dataset = path.join(mounts, 'site,data:/workspace/runKit:rw')
  const output = path.join(mounts, 'output')
  for (const dir of [dataset, output]) await mkdir(dir, { recursive: true })
  await writeFile(path.join(dataset, 'subject.txt'), 'dataset')
  const script = [
    'cat /workspace/data/subject.txt > /workspace/output/read.txt',
    'if touch /workspace/data/written 2>/dev/null; then echo writable > /workspace/output/data-writable; fi',
  ].join('; ')
  const outcome = await new Promise((resolve, reject) => {
    launchNode({
      containerService: 'docker',
      imageName: dockerImage,
      directoriesToMount: [
        { hostDirectory: output, containerDirectory: '/workspace/output', readOnly: false },
        { hostDirectory: dataset, containerDirectory: '/workspace/data', readOnly: true },
      ],
      portBindings: [],
      commandsToRun: ['sh', '-c', script],
      onContainerExitSuccess: () => resolve('success'),
      onContainerExitError: (_, error) => resolve(`error: ${error}`),
    }).catch(reject)
  })
  assert.equal(outcome, 'success')
  assert.deepEqual(await readdir(output), ['read.txt'])
  assert.deepEqual(await readdir(dataset), ['subject.txt'])
})
