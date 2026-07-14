import { expect, Page, test } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'
import { exec } from 'child_process'
import { promisify } from 'util'
import { COMPUTATION_TIMEOUT, USER_1 } from '../libs/constants'
import { destroyAllInstances, setup } from '../libs/setup'
import user from '../libs/user'
import computation from '../libs/computation'
import consortia from '../libs/consortia'

const CONSORTIUM_ID = uuidv4()

const execPromise = promisify(exec)

const DATA = {
  consortium: {
    name: `e2e-srr-freesurfer-${CONSORTIUM_ID}`,
    description: `e2e-srr-freesurfer-${CONSORTIUM_ID}`,
  },
  computation: {
    name: 'coinstacteam/nfc-single-round-ridge-regression-freesurfer',
  },
}

test.describe('Single-round Ridge Regression for Freesurfer computation', () => {
  let page: Page

  test.beforeAll(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1)) as Page
    await execPromise(`docker pull ${DATA.computation.name}`)
  })

  test.afterAll(async () => {
    await destroyAllInstances()
  })

  test('runs a computation', async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    await expect(page).toHaveTitle('NeuroFLAME')
    await user.logIn(USER_1, page)
    await consortia.create(DATA.consortium, page)
    await computation.select(DATA.computation, page)
    await computation.setDataForSRRFreesurfer(page)
    await computation.run(page)
    await user.logOut(page)
  })
})
