import { app, BrowserWindow, session } from 'electron'
import { fileURLToPath } from 'node:url'
import { installEdgeLocalApiKey } from '../../build/edgeLocalApiKey.js'
import { isAppRendererFrame } from '../../build/appRenderer.js'
import { installWindowSecurity } from '../../build/windowSecurity.js'

const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`)).slice(name.length + 3)
app.setPath('userData', argument('fixture-base'))
app.setPath('sessionData', argument('fixture-base'))
globalThis.externalRequests = []
globalThis.niftiRequests = []

app.whenReady().then(async () => {
  const edge = argument('edge-url')
  const appUrl = argument('app-url')
  const appSession = session.fromPartition('persist:report-isolation-test')
  installEdgeLocalApiKey(
    appSession,
    [`${edge}/graphql`, `${edge.replace('http', 'ws')}/graphql`, `${edge}/run-results`],
    argument('local-api-key'),
    (frame) => isAppRendererFrame(appUrl, frame),
  )
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: fileURLToPath(new URL('./canaryPreload.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      session: appSession,
    },
  })
  installWindowSecurity(window.webContents, {
    appUrl,
    isAppWindow: true,
    edgeResultsUrl: `${edge}/run-results`,
    onViewNifti: (url) => { globalThis.niftiRequests.push(url) },
    openExternal: async (url) => { globalThis.externalRequests.push(url) },
  })
  await window.loadURL(appUrl)
})
