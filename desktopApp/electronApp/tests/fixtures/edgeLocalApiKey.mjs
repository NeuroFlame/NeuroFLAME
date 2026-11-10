import { app, BrowserWindow, session } from 'electron'
import { installEdgeLocalApiKey } from '../../build/edgeLocalApiKey.js'
import { isAppRendererFrame } from '../../build/appRenderer.js'

const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`)).slice(name.length + 3)
app.setPath('userData', argument('fixture-base'))
app.setPath('sessionData', argument('fixture-base'))

app.whenReady().then(async () => {
  const edge = argument('edge-url')
  const appSession = session.fromPartition('persist:edge-local-api-key-test')
  installEdgeLocalApiKey(
    appSession,
    [`${edge}/graphql`, `${edge.replace('http', 'ws')}/graphql`, `${edge}/run-results`],
    argument('local-api-key'),
    (frame) => isAppRendererFrame(argument('page-url'), frame),
  )
  const window = new BrowserWindow({ show: false, webPreferences: { session: appSession } })
  await window.loadURL(argument('page-url'))
})
