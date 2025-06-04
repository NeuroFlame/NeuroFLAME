import { expect, Page, test } from "@playwright/test"
import { v4 as uuidv4 } from "uuid"
import { exec } from "child_process"
import { promisify } from "util"
import { COMPUTATION_TIMEOUT, USER_1 } from "../libs/constants"
import { destroyAllInstances, setup } from "../libs/setup"
import user from "../libs/user"
import computation from "../libs/computation"
import consortia from "../libs/consortia"

const CONSORTIUM_ID = uuidv4()

const execPromise = promisify(exec);

const DATA = {
  consortium: {
    name: `e2e-srr-freesurfer-${CONSORTIUM_ID}`,
    description: `e2e-srr-freesurfer-${CONSORTIUM_ID}`,
  },
  computation: {
    name: 'sbasodi1/test_neuroflame_comp_srr_freesurfer',
  },
}

test.describe("Single-round Ridge Regression for Freesurfer computation", () => {
  let page: Page

  test.beforeAll(async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    page = (await setup(1)) as Page
    await execPromise(`docker pull ${DATA.computation.name}`)
  })

  test.afterAll(async () => {
    await destroyAllInstances()
  })

  test('displays the correct title', async () => {
    expect(await page.title()).toEqual("NeuroFLAME")
  })

  test('authenticates user', async () => {
    await user.logIn(USER_1, page)
  })

  test('create a consortium', async () => {
    await consortia.create(DATA.consortium, page)
  })

  test('run a computation', async () => {
    test.setTimeout(COMPUTATION_TIMEOUT)
    await computation.select(DATA.computation, page)
    await computation.setDataForSRRFreesurfer(page)
    await computation.run(page)
  })

  test('log out user', async () => {
    await user.logOut(page)
  })
})
