import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { build } from 'esbuild'

const rendererRoot = fileURLToPath(new URL('../../../reactApp', import.meta.url))

test('Docker success enables wizard progression without relying on chunk boundaries or one image name', async () => {
  // Exercise the real wizard, download step, terminal component and preload
  // adapters; only consortium state and Electron IPC are synthetic.
  const bundle = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { MemoryRouter, Route, Routes } from 'react-router-dom';
        import Wizard from './src/pages/ConsortiumWizard/ConsortiumWizard';
        createRoot(document.getElementById('root')).render(
          <MemoryRouter initialEntries={['/consortium/wizard/synthetic']}>
            <Routes><Route path='/consortium/wizard/:consortiumId/*' element={<Wizard />} /></Routes>
          </MemoryRouter>
        );
      `,
      loader: 'tsx',
      resolveDir: rendererRoot,
    },
    bundle: true,
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'synthetic-wizard-services',
      setup(builder) {
        const mocks = /ConsortiumDetailsContext|UserStateContext|ConsortiumWizardNavBar|ComputationSelect|\/steps\/Step/
        builder.onResolve({ filter: mocks }, ({ path }) => path.endsWith('/StepDownloadImage') ? undefined : {
          path: path.endsWith('ConsortiumDetailsContext') ? 'ConsortiumDetailsContext' : path,
          namespace: 'fixture',
        })
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
          let contents
          if (path.endsWith('ConsortiumDetailsContext')) {
            contents = `
              import { createContext, useContext, useState } from 'react';
              const Context = createContext(null);
              export function ConsortiumDetailsProvider({ children }) {
                const [image, setImage] = useState('example/computation');
                window.selectTestImage = setImage;
                return <Context.Provider value={{ isLeader: false, data: {
                  title: 'Synthetic consortium', readyMembers: [], studyConfiguration: {
                    computation: { title: 'Synthetic computation', imageName: image, imageDownloadUrl: 'docker pull ' + image }
                  }
                } }}>{children}</Context.Provider>;
              }
              export const useConsortiumDetailsContext = () => useContext(Context);
            `
          } else if (path.endsWith('UserStateContext')) {
            contents = 'export const useUserState = () => ({ userId: "synthetic-user" });'
          } else if (path.endsWith('ConsortiumWizardNavBar')) {
            contents = `
              export default function Nav({ steps, handleStepNav }) {
                return <nav>{steps.map(({ label, path }) =>
                  <button key={path} onClick={() => handleStepNav(path)}>{label}</button>
                )}</nav>;
              }
            `
          } else {
            contents = 'export default function OtherStep() { return null; }'
          }
          return { contents, loader: 'tsx', resolveDir: rendererRoot }
        })
      },
    }],
  })
  const browser = await chromium.launch({ channel: process.env.WIZARD_TEST_BROWSER || 'chromium' })
  try {
    const page = await browser.newPage()
    page.on('pageerror', (error) => { console.error(error.message) })
    await page.setContent('<div id="root"></div>')
    await page.evaluate(() => {
      window.inputs = []
      window.outputListeners = []
      window.startRequests = []
      window.testRuntime = 'docker'
      window.ElectronAPI = {
        getConfig: async () => ({ edgeClientConfig: { containerService: window.testRuntime } }),
        spawnTerminal: () => new Promise((resolve, reject) => window.startRequests.push({ resolve, reject })),
        terminalInput: (input) => window.inputs.push(input),
        terminalOutput: (callback) => window.outputListeners.push(callback),
        removeTerminalOutputListener: () => { window.outputListeners = [] },
        checkSingularityImageExists: async () => false,
        pullSingularityImage: () => new Promise((resolve) => { window.completeSingularityPull = resolve }),
        singularityPullOutput: () => {},
        removeSingularityPullOutputListener: () => {},
      }
      window.emitOutput = (chunk) => window.outputListeners.forEach((callback) => callback(null, chunk))
    })
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    await page.getByRole('button', { name: 'Download Computation Image', exact: true }).click()
    const pull = page.getByRole('button', { name: 'Run Docker Pull', exact: true })
    const next = page.getByRole('button', { name: 'Go To Next Step', exact: true })
    await expect(pull).toBeDisabled()
    await expect.poll(() => page.evaluate(() => window.startRequests.length)).toBe(1)
    assert.deepEqual(await page.evaluate(() => window.inputs), [])
    await page.evaluate(() => window.startRequests[0].resolve({ status: 'terminalStarted' }))
    await expect(pull).toBeEnabled()
    assert.deepEqual(await page.evaluate(() => window.inputs), ['docker image inspect example/computation'])
    await pull.click()
    await page.evaluate(() => window.emitOutput('Pull complete\nError response from daemon: manifest unknown\n'))
    await expect(next).toHaveCount(0)
    await page.evaluate(() => window.emitOutput('Status: Image is up to date for example/unrelated:latest\n'))
    await expect(next).toHaveCount(0)
    await page.evaluate(() => {
      for (const chunk of ['Status: Image is up ', 'to date for docker.io/example/', 'computation:latest\n']) {
        window.emitOutput(chunk)
      }
    })
    await expect(next).toBeVisible()

    // Changing the selected computation resets readiness and ignores callbacks
    // retained from the previous terminal subscription.
    await page.evaluate(() => {
      window.oldListener = window.outputListeners[0]
      window.selectTestImage('example/another')
    })
    await expect(next).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.startRequests.length)).toBeGreaterThan(1)
    await page.evaluate(() => {
      window.oldListener(null, 'Status: Image is up to date for example/computation:latest\n')
      window.startRequests.forEach(({ resolve }) => resolve({ status: 'terminalStarted' }))
    })
    await expect(pull).toBeEnabled()
    await expect(next).toHaveCount(0)
    await pull.click()
    await page.evaluate(() => window.emitOutput('Status: Downloaded newer image for example/another:latest\n'))
    await expect(next).toBeVisible()

    // Returning to the download step probes the already-installed image.
    await page.getByRole('button', { name: 'Select Data Directory', exact: true }).click()
    await page.getByRole('button', { name: 'Download Computation Image', exact: true }).click()
    await expect(pull).toBeDisabled()
    await page.evaluate(() => window.startRequests.forEach(({ resolve }) => resolve({ status: 'terminalStarted' })))
    await expect(pull).toBeEnabled()
    await page.evaluate(() => {
      window.emitOutput('    "I')
      window.emitOutput(`d": "sha256:${'a'.repeat(64)}",\n`)
    })
    await expect(next).toBeVisible()
    await next.click()
    await expect(page.getByRole('heading', { name: 'Step 4: Set Ready Status' })).toBeVisible()

    // The shared download component must keep the Singularity path working and
    // must not initialize a Docker shell while its configuration is loading.
    const terminalCount = await page.evaluate(() => window.startRequests.length)
    await page.evaluate(() => { window.testRuntime = 'singularity' })
    await page.getByRole('button', { name: 'Download Computation Image', exact: true }).click()
    await expect(next).toHaveCount(0)
    await page.getByRole('button', { name: 'Run Singularity Pull', exact: true }).click()
    assert.equal(await page.evaluate(() => window.startRequests.length), terminalCount)
    await page.evaluate(() => window.completeSingularityPull({
      alreadyExists: false,
      imagePath: '/synthetic/image.sif',
    }))
    await expect(next).toBeVisible()

    // Startup failures must keep progression blocked and report the problem.
    await page.getByRole('button', { name: 'Select Data Directory', exact: true }).click()
    await page.evaluate(() => { window.testRuntime = 'docker' })
    await page.getByRole('button', { name: 'Download Computation Image', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.startRequests.length)).toBe(terminalCount + 1)
    await page.evaluate(() => window.startRequests.at(-1).reject(new Error('synthetic startup failure')))
    await expect(page.getByText('Unable to start the Docker terminal.', { exact: false })).toBeVisible()
    await expect(pull).toBeDisabled()
    await expect(next).toHaveCount(0)
  } finally {
    await browser.close()
  }
})
