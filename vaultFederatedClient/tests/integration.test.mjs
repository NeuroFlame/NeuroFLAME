import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { buildSchema, parse, validate } from 'graphql'

const base = await mkdtemp(path.join(tmpdir(), 'nf-vault-'))
const labelsFile = path.join(base, 'labels.json')
const bin = path.join(base, 'bin')
await mkdir(bin)
// Stands in for `singularity inspect --labels --json`.
await writeFile(path.join(bin, 'singularity'), `#!/bin/sh
case "$1" in
  inspect) cat "${labelsFile}" ;;
  *) exit 1 ;;
esac
`)
await chmod(path.join(bin, 'singularity'), 0o755)
const originalPath = process.env.PATH
process.env.PATH = `${bin}${path.delimiter}${originalPath}`

// Stands in for the central API: validates each request against its schema, and
// serves a kit download that stalls part way through.
const typeDefs = new URL('../../centralApi/src/graphql/typeDefs.graphql', import.meta.url)
const schema = buildSchema(await readFile(typeDefs, 'utf8'))
const reports = []
const central = createServer((request, response) => {
  if (request.url === '/stalled') {
    response.setHeader('content-length', 100)
    response.write('partial')
    return
  }
  let body = ''
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => {
    const { query, variables } = JSON.parse(body)
    const document = parse(query)
    const errors = validate(schema, document).map(({ message }) => message)
    for (const definition of document.definitions[0].variableDefinitions) {
      const name = definition.variable.name.value
      if (definition.type.kind === 'NonNullType' && variables[name] == null) errors.push(`$${name} must not be null`)
    }
    reports.push({ variables, errors })
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(errors.length
      ? { errors: errors.map((message) => ({ message })) }
      : { data: { reportRunError: true } }))
  })
})
await new Promise((resolve) => central.listen(0, '127.0.0.1', resolve))
const centralUrl = `http://127.0.0.1:${central.address().port}`

// Configuration is read at import time.
Object.assign(process.env, {
  VAULT_HTTP_URL: `${centralUrl}/graphql`,
  VAULT_WS_URL: 'ws://127.0.0.1:9/graphql',
  VAULT_ACCESS_TOKEN: 'test-token',
  VAULT_BASE_DIR: path.join(base, 'vault'),
  VAULT_DATASET_DIR: path.join(base, 'datasets'),
})
const { prepareResolvedComputationImage } = await import('../dist/imageManager.js')
const { launchNode } = await import('../dist/runCoordinator/nodeManager/launchNode.js')
const { default: reportRunError } = await import('../dist/runCoordinator/report/reportRunError.js')
const { default: downloadFile } = await import('../dist/runCoordinator/eventHandlers/runStart/downloadFile.js')

after(async () => {
  process.env.PATH = originalPath
  central.closeAllConnections()
  await new Promise((resolve) => central.close(resolve))
  await rm(base, { recursive: true, force: true })
})

const digest = `sha256:${'f'.repeat(64)}`
const metadata = {
  title: 'Computation',
  computationVersion: '1.0.0',
  revision: 'abcdef1',
  source: 'https://example.test/computation',
  computationApiVersion: '0.1.0',
  boilerplateVersion: '0.1.0',
  nvflareVersion: '2.8.0',
}
const resolvedImage = { sourceImage: 'example/computation:1', reference: `example/computation@${digest}`, digest, metadata }
const labels = (overrides = {}) => ({
  'org.opencontainers.image.title': metadata.title,
  'org.opencontainers.image.version': metadata.computationVersion,
  'org.opencontainers.image.revision': ` ${metadata.revision} `,
  'org.opencontainers.image.source': metadata.source,
  'org.neuroflame.computation-api.version': metadata.computationApiVersion,
  'org.neuroflame.boilerplate.version': metadata.boilerplateVersion,
  'org.neuroflame.nvflare.version': metadata.nvflareVersion,
  ...overrides,
})
const setLabels = (value) => writeFile(labelsFile, JSON.stringify({ data: { attributes: { labels: value } } }))

test('the vault runs the SIF for the exact run digest, only after a label check, only from its cache', async () => {
  const cached = path.join(
    base, 'vault', 'singularityImages', `example_computation_sha256_${'f'.repeat(64)}-${'f'.repeat(12)}.sif`,
  )
  await mkdir(path.dirname(cached), { recursive: true })
  await writeFile(cached, 'sif')
  await setLabels(labels({ 'org.neuroflame.computation-api.version': '9.9.9' }))
  await assert.rejects(prepareResolvedComputationImage(resolvedImage, 'singularity'), /computation-api.*does not match/)
  // Labels are compared after trimming, as central records them.
  await setLabels(labels())
  assert.equal(await prepareResolvedComputationImage(resolvedImage, 'singularity'), cached)

  await assert.rejects(launchNode({
    containerService: 'singularity',
    imageName: resolvedImage.reference,
    runId: 'r',
    consortiumId: 'c',
    directoriesToMount: [],
    portBindings: [],
    commandsToRun: [],
  }), /not a prepared image in the private image cache/)
})

test('a start failure is reported to central even without a hosted vault id', async () => {
  await reportRunError({ runId: 'r', vaultId: null, errorMessage: 'No hosted vault id was provided' })
  await reportRunError({ runId: 'r', vaultId: 'v', errorMessage: 'failed' })
  assert.deepEqual(reports.map(({ errors }) => errors), [[], []])
  assert.deepEqual(reports.map(({ variables }) => variables.vaultId), [null, 'v'])
})

test('a stalled kit download fails instead of hanging and leaves no file', async () => {
  const dir = path.join(base, 'download')
  await assert.rejects(downloadFile({
    url: `${centralUrl}/stalled`, accessToken: 't', pathOutputDir: dir, outputFilename: 'kit.zip', idleTimeoutMs: 300,
  }), /no data received/)
  await assert.rejects(lstat(path.join(dir, 'kit.zip')), { code: 'ENOENT' })
})
