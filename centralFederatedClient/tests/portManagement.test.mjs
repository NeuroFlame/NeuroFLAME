import assert from 'node:assert/strict'
import test from 'node:test'
import { reservePort } from '../dist/runCoordinator/eventHandlers/runStart/portManagement.js'

function fakeDocker(startResults) {
  const containers = []
  return {
    containers,
    client: {
      async createContainer(options) {
        const startResult = startResults.shift()
        const container = {
          options,
          removeCalls: 0,
          async start() {
            if (startResult instanceof Error) throw startResult
          },
          async remove() {
            this.removeCalls++
          },
        }
        containers.push(container)
        return container
      },
    },
  }
}

test('reserves the requested port on the Docker host', async () => {
  const docker = fakeDocker([undefined])
  const reservation = await reservePort(
    { start: 3010, end: 3010, imageName: 'computation@sha256:test' },
    docker.client,
  )

  assert.equal(reservation.port, 3010)
  assert.deepEqual(
    docker.containers[0].options.HostConfig.PortBindings['3010/tcp'],
    [{ HostPort: '3010' }],
  )
  await reservation.release()
  await reservation.release()
  assert.equal(docker.containers[0].removeCalls, 1)
})

test('skips a Docker host port that is already allocated', async () => {
  const docker = fakeDocker([
    new Error('Bind for 0.0.0.0:3010 failed: port is already allocated'),
    undefined,
  ])
  const reservation = await reservePort(
    { start: 3010, end: 3011, imageName: 'computation@sha256:test' },
    docker.client,
  )

  assert.equal(reservation.port, 3011)
  assert.equal(docker.containers[0].removeCalls, 1)
  await reservation.release()
})

test('does not hide non-port Docker failures', async () => {
  const docker = fakeDocker([new Error('Docker daemon unavailable')])

  await assert.rejects(
    reservePort(
      { start: 3010, end: 3011, imageName: 'computation@sha256:test' },
      docker.client,
    ),
    /Docker daemon unavailable/,
  )
  assert.equal(docker.containers.length, 1)
  assert.equal(docker.containers[0].removeCalls, 1)
})
