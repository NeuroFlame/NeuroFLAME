import assert from 'node:assert/strict'
import test from 'node:test'
import Docker from 'dockerode'
import { launchNode, stopDockerNode } from '../dist/runCoordinator/nodeManager/launchNode.js'

// Any local image with `sleep` and `false`; Docker must be running.
const image = process.env.CENTRAL_DOCKER_TEST_IMAGE ?? 'mongo:7.0'
const docker = new Docker()
const available = await docker.getImage(image).inspect().then(() => true, () => false)
const dockerTest = (name, fn) => test(name, { skip: !available && `needs Docker and ${image}`, timeout: 60000 }, fn)

const waitForRemoval = async (containerId) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const exists = await docker.getContainer(containerId).inspect().then(() => true, () => false)
    if (!exists) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`container ${containerId} was not removed`)
}

const launch = (commandsToRun, outcomes) => launchNode({
  containerService: 'docker',
  imageName: image,
  directoriesToMount: [],
  portBindings: [],
  commandsToRun,
  onContainerExitSuccess: () => { outcomes.push('success') },
  onContainerExitError: () => { outcomes.push('error') },
})

dockerTest('an orchestrator stop removes the node without reporting a run outcome', async () => {
  const outcomes = []
  const containerId = await launch(['sleep', '60'], outcomes)
  await stopDockerNode(containerId)
  await waitForRemoval(containerId)
  assert.deepEqual(outcomes, [])
  // Stopping an already removed node is not an error.
  await stopDockerNode(containerId)
})

dockerTest('a node that fails on its own is still reported', async () => {
  const outcomes = []
  const containerId = await launch(['false'], outcomes)
  await waitForRemoval(containerId)
  assert.deepEqual(outcomes, ['error'])
})
