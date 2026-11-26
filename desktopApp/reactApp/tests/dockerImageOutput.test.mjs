import assert from 'node:assert/strict'
import test from 'node:test'
import { createDockerImageDetector } from '../src/pages/ConsortiumDetails/Computation/dockerImageOutput.ts'

const image = 'example/computation'
const idLine = `    "Id": "sha256:${'a'.repeat(64)}",\n`

for (const line of [
  idLine,
  `Status: Downloaded newer image for ${image}:latest\n`,
  `Status: Image is up to date for docker.io/${image}:latest\r\n`,
]) {
  test(`detects success at every possible chunk boundary: ${line.trim()}`, () => {
    for (let split = 0; split < line.length; split++) {
      const detect = createDockerImageDetector(image)
      assert.equal(detect(line.slice(0, split)), line.slice(0, split).endsWith('\r'))
      assert.equal(detect(line.slice(split)), true)
    }
    const detect = createDockerImageDetector(image)
    for (const byte of line.replace(/\r?\n$/, '')) assert.equal(detect(byte), false)
    assert.equal(detect('\n'), true)
  })
}

test('matches default tags, explicit tags, registries, and digests for the selected image', () => {
  for (const [requested, reported] of [
    ['alpine', 'docker.io/library/alpine:latest'],
    ['example/computation:v2', 'example/computation:v2'],
    ['localhost:5000/computation', 'localhost:5000/computation:latest'],
    [`example/computation@sha256:${'a'.repeat(64)}`, `example/computation@sha256:${'a'.repeat(64)}`],
  ]) {
    const detect = createDockerImageDetector(requested)
    assert.equal(detect(`Status: Image is up to date for ${reported}\n`), true)
  }
})

test('progress, errors, unrelated images and malformed inspect output do not enable progression', () => {
  const detect = createDockerImageDetector(image)
  for (const chunk of [
    'Pull complete\n',
    'Digest: sha256:abcd\n',
    'Error response from daemon: manifest unknown\n',
    'docker.io/coinstacteam/nfc-single-round-ridge-regression-freesurfer:latest\n',
    'Status: Image is up to date for example/another:latest\n',
    'Status: Image is up to date for example/computation:v2\n',
    'failure: Status: Downloaded newer image for example/computation:latest\n',
    '"Id": "sha256:truncated",\n',
  ]) assert.equal(detect(chunk), false)
})

test('a new detector discards success and partial output from the previous image', () => {
  const first = createDockerImageDetector(image)
  assert.equal(first(`Status: Image is up to date for ${image}:latest\n`), true)
  const second = createDockerImageDetector('example/another')
  assert.equal(second('latest\n'), false)
  assert.equal(second(`Status: Image is up to date for ${image}:latest\n`), false)
  assert.equal(second('Status: Image is up to date for example/another:latest\n'), true)
})

test('a long incomplete progress line does not hide the next success line', () => {
  const detect = createDockerImageDetector(image)
  assert.equal(detect('x'.repeat(100000)), false)
  assert.equal(detect(`\nStatus: Image is up to date for ${image}:latest\n`), true)
})
