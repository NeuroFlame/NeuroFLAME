import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { resolveContainerFailureReport } from '../dist/runCoordinator/terminalError.js'

const genericError = 'Error in container: container-id'
const markerName = '.neuroflame_error.json'
const validMarker = JSON.parse(await fs.readFile(
  new URL('./fixtures/neuroflame_terminal_error_v1.json', import.meta.url),
  'utf8',
))

const withOutputDirectory = async (callback) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-error-test-'))
  try {
    await callback(directory)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}

const resolve = (outputDirectory, disclosure = 'detailed') =>
  resolveContainerFailureReport({ outputDirectory, disclosure, genericError })

const redactedFallback = {
  errorMessage: genericError,
  redactErrorDetails: true,
}

test('redacted failures never read or disclose a valid marker', async () => {
  await withOutputDirectory(async (directory) => {
    await fs.writeFile(path.join(directory, markerName), JSON.stringify(validMarker))
    assert.deepEqual(await resolve(directory, 'redacted'), redactedFallback)
  })
})

test('detailed failures disclose a validated terminal marker', async () => {
  await withOutputDirectory(async (directory) => {
    await fs.writeFile(path.join(directory, markerName), JSON.stringify(validMarker))
    const reported = await resolve(directory)
    assert.equal(reported.redactErrorDetails, false)
    assert.match(reported.errorMessage, /Hosted vault disclosed computation failure/)
    assert.match(reported.errorMessage, /Missing required covariate column: isControl/)
    assert.match(reported.errorMessage, /Traceback \(most recent call last\)/)
  })
})

for (const [name, content] of [
  ['missing', undefined],
  ['malformed', '{not-json'],
  ['wrong schema', JSON.stringify({ ...validMarker, schema_version: 2 })],
  ['path-manipulated', JSON.stringify({ ...validMarker, path: '/etc/passwd' })],
  ['unsafe', JSON.stringify({ ...validMarker, message: 'Authorization: Bearer secret-token-value' })],
]) {
  test(`${name} terminal markers fall back to the generic error`, async () => {
    await withOutputDirectory(async (directory) => {
      if (content !== undefined) {
        await fs.writeFile(path.join(directory, markerName), content)
      }
      assert.deepEqual(await resolve(directory), redactedFallback)
    })
  })
}

test('oversized terminal markers fall back to the generic error', async () => {
  await withOutputDirectory(async (directory) => {
    await fs.writeFile(path.join(directory, markerName), 'x'.repeat(64 * 1024 + 1))
    assert.deepEqual(await resolve(directory), redactedFallback)
  })
})

test('symlinked terminal markers cannot escape the result directory', async () => {
  await withOutputDirectory(async (directory) => {
    const external = path.join(os.tmpdir(), `external-marker-${process.pid}.json`)
    try {
      await fs.writeFile(external, JSON.stringify(validMarker))
      await fs.symlink(external, path.join(directory, markerName))
      assert.deepEqual(await resolve(directory), redactedFallback)
    } finally {
      await fs.rm(external, { force: true })
    }
  })
})

test('arbitrary container log files are never forwarded', async () => {
  await withOutputDirectory(async (directory) => {
    const arbitraryLog = 'patient subject-123 password=hunter2'
    await fs.writeFile(path.join(directory, 'failed-container.log'), arbitraryLog)
    const reported = await resolve(directory)
    assert.deepEqual(reported, redactedFallback)
    assert.equal(reported.errorMessage.includes(arbitraryLog), false)
  })
})
