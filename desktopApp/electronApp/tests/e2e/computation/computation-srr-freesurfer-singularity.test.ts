import { expect, Page, test } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'
import { exec, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { COMPUTATION_TIMEOUT, USER_1 } from '../../libs/constants'
import { configPathFor, destroyAllInstances, setup } from '../../libs/setup'
import user from '../../libs/user'
import computation, { SRR_FREESURFER_SITE1_DIR } from '../../libs/computation'
import consortia from '../../libs/consortia'

const CONSORTIUM_ID = uuidv4()
const CONFIG_NAME = 'electronAppSingularity'

const execPromise = promisify(exec)

const DATA = {
  consortium: {
    name: `e2e-srr-freesurfer-singularity-${CONSORTIUM_ID}`,
    description: `e2e-srr-freesurfer-singularity-${CONSORTIUM_ID}`,
  },
  computation: {
    name: 'coinstacteam/nfc-single-round-ridge-regression-freesurfer',
  },
}

const hasApptainer = () =>
  ['apptainer', 'singularity'].some((binary) => spawnSync('which', [binary]).status === 0)

test.describe('Single-round Ridge Regression for Freesurfer on Singularity', () => {
  let page: Page

  // CI installs Apptainer and the config, so a missing runtime there is a failure, not a skip.
  test.skip(
    process.env.CI !== 'true' && (!hasApptainer() || !fs.existsSync(configPathFor(CONFIG_NAME))),
    'Needs Apptainer and the CI Singularity config',
  )

  test.beforeAll(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1, CONFIG_NAME)) as Page
    // The central node still runs on Docker.
    await execPromise(`docker pull ${DATA.computation.name}:latest`)
  })

  test.afterAll(async () => {
    await destroyAllInstances()
  })

  test('pulls the image through the edge client and runs a computation', async () => {
    test.setTimeout(COMPUTATION_TIMEOUT * 4)
    await expect(page).toHaveTitle('NeuroFLAME')
    await user.logIn(USER_1, page)
    await consortia.create(DATA.consortium, page)
    // The pull button resolves :latest; the run then pins the same digest and reuses that SIF.
    await computation.select(DATA.computation, page, { singularity: true })
    await computation.setDataForSRRFreesurfer(page, SRR_FREESURFER_SITE1_DIR)
    await computation.run(page)

    // One cached image means the run found the button's pull instead of pulling again.
    const { edgeClientConfig } = JSON.parse(fs.readFileSync(configPathFor(CONFIG_NAME), 'utf8'))
    const cached = fs.readdirSync(path.join(edgeClientConfig.pathBaseDirectory, 'singularityImages'))
    expect(cached.filter((file) => file.endsWith('.sif'))).toHaveLength(1)
    expect(cached.filter((file) => file.endsWith('.tmp'))).toHaveLength(0)

    await user.logOut(page)
  })
})
