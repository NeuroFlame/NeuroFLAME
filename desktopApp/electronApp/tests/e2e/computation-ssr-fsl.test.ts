import { expect, Page, test } from "@playwright/test"
import { COMPUTATION_TIMEOUT, USER_1 } from "../libs/constants"
import { destroyAllInstances, setup } from "../libs/setup"
import user from "../libs/user"
import computation from "../libs/computation"
import consortia from "../libs/consortia"

const DATA = {
  consortium: {
    name: 'e2e-ssr-fsl',
    description: 'e2e-ssr-fsl',
  },
  computation: {
    name: 'sbasodi1/test_neuroflame_comp_srr_freesurfer',
  },
}

test.describe("SSR-FSL computation", () => {
  let page: Page

  test.beforeAll(async () => {
    page = (await setup(1)) as Page
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
    await computation.setDataForSSRFSL(page)
    await computation.run(page)
  })

  test('log out user', async () => {
    await user.logOut(page)
  })
})
