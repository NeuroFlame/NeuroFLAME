import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { build } from 'esbuild'

const rendererRoot = fileURLToPath(new URL('../../../reactApp', import.meta.url))

test('wizard navigation stays below step actions as content and window sizes change', async () => {
  // Render the real wizard shell with synthetic step content. No API, Electron
  // terminal, dataset, or image-download operations are invoked.
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
      name: 'synthetic-wizard-context',
      setup(builder) {
        builder.onResolve({ filter: /ConsortiumDetailsContext|UserStateContext|ConsortiumWizardNavBar|\/steps\/Step/ },
          ({ path: importPath }) => ({ path: importPath, namespace: 'fixture' }))
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: importPath }) => {
          let contents
          if (importPath.endsWith('ConsortiumDetailsContext')) {
            contents = `
              export const ConsortiumDetailsProvider = ({ children }) => children;
              export const useConsortiumDetailsContext = () => ({
                isLeader: false,
                data: { title: 'Synthetic consortium', readyMembers: [], studyConfiguration: {} }
              });
            `
          } else if (importPath.endsWith('UserStateContext')) {
            contents = 'export const useUserState = () => ({ userId: "synthetic-user" });'
          } else if (importPath.endsWith('ConsortiumWizardNavBar')) {
            contents = `
              export default function Nav({ steps, handleStepNav }) {
                return <nav>{steps.map(({ label, path }) =>
                  <button key={path} onClick={() => handleStepNav(path)}>{label}</button>
                )}</nav>;
              }
            `
          } else {
            contents = `
              import { useState } from 'react';
              import { Box, Button } from '@mui/material';
              export default function Step() {
                const [expanded, setExpanded] = useState(false);
                return <Box data-testid='step-content' sx={{ minHeight: expanded ? 900 : 320 }}>
                  <p>Download instructions and computation details</p>
                  <Button variant='contained' onClick={() => setExpanded(!expanded)}>Run Docker Pull</Button>
                </Box>;
              }
            `
          }
          return { contents, loader: 'tsx', resolveDir: rendererRoot }
        })
      },
    }],
  })

  const browser = await chromium.launch({ channel: process.env.WIZARD_TEST_BROWSER || 'chromium' })
  try {
    const page = await browser.newPage()
    await page.setContent('<div id="root"></div>')
    await page.addStyleTag({ content: await readFile(path.join(rendererRoot, 'src/App.css'), 'utf8') })
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    await page.getByRole('button', { name: 'Download Computation Image', exact: true }).click()

    for (const viewport of [{ width: 1280, height: 800 }, { width: 800, height: 600 }, { width: 480, height: 640 }]) {
      await page.setViewportSize(viewport)
      for (const expanded of [false, true]) {
        if (expanded) await page.getByRole('button', { name: 'Run Docker Pull', exact: true }).click()
        const content = await page.getByTestId('step-content').boundingBox()
        const back = await page.getByRole('button', { name: 'Go Back A Step', exact: true }).boundingBox()
        assert.ok(content && back)
        assert.ok(back.y >= content.y + content.height, `navigation overlaps content at ${JSON.stringify(viewport)}`)
        await page.getByRole('button', { name: 'Go Back A Step', exact: true }).scrollIntoViewIfNeeded()
        assert.equal(await page.getByRole('button', { name: 'Go Back A Step', exact: true }).isVisible(), true)
        if (expanded) await page.getByRole('button', { name: 'Run Docker Pull', exact: true }).click()
      }
    }
  } finally {
    await browser.close()
  }
})
