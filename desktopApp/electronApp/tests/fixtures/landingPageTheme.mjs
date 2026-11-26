import { app, BrowserWindow, session, net } from 'electron'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { installLandingPageTheme } from '../../build/landingPageTheme.js'
import { installResultReportTheme } from '../../build/resultReportTheme.js'

const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`)).slice(name.length + 3)
app.setPath('userData', argument('fixture-base'))
app.setPath('sessionData', argument('fixture-base'))

app.whenReady().then(async () => {
  const landing = process.env.LANDING_PAGE_HTML ? await readFile(process.env.LANDING_PAGE_HTML, 'utf8') : `
    <!doctype html><html><head><style>
      body { background: #f2f2f2; color: #333; font-family: Arial; margin: 0; }
      .fl-row-content-wrap { padding: 20px; background: #f2f2f2; }
      .row-metrics .fl-row-content { display: flex; gap: 20px; }
      .fl-col { flex: 1; }
      .fl-col-content { background: white; border-radius: 20px; padding: 24px; }
      h5 { font-size: 18px; margin: 0; color: #333; }
      h2 { font-size: 48px; color: red; margin-bottom: 0; }
      h4 { color: #0066ff; font-size: 24px; }
      p { color: #888; line-height: 1.6; }
    </style></head><body class="fl-page">
      <div class="row-metrics"><div class="fl-row-content-wrap"><div class="fl-row-content">
        <div class="fl-col"><div class="fl-col-content"><h5><span class="fl-heading-text">Global Collaborators</span></h5><h2><span class="fl-heading-text">87</span></h2></div></div>
        <div class="fl-col"><div class="fl-col-content"><h5><span class="fl-heading-text">Papers Published</span></h5><h2><span class="fl-heading-text">47</span></h2></div></div>
        <div class="fl-col"><div class="fl-col-content"><h5><span class="fl-heading-text">Completed Research Studies</span></h5><h2><span class="fl-heading-text">20</span></h2></div></div>
      </div></div></div>
      <div class="fl-row-content-wrap"><div class="fl-col-content">
        <h4 class="fl-heading"><span class="fl-heading-text">What Is NeuroFLAME?</span></h4>
        <div class="fl-rich-text"><p>Synthetic landing-page description with <strong>readable text</strong>.</p></div>
      </div></div>
    </body></html>`
  await session.defaultSession.protocol.handle('https', (request) => {
    if (request.url.startsWith('https://coinstac.org/run-results/')) {
      return new Response(`<!doctype html><html><head><style>
        :root { --bg:white; --text:#202a3a; --card:white; }
        [data-theme=dark] { --bg:#0f172a; --text:#e2e8f0; --card:#1e293b; }
        body { background:var(--bg); color:var(--text); font:16px Arial; padding:32px; }
        section { background:var(--card); padding:24px; border-radius:16px; }
      </style></head><body>
        <button id=themeBtn class=theme-toggle onclick="document.documentElement.setAttribute('data-theme','dark')">Dark mode</button>
        <h1>Synthetic regression report</h1><section><h2>Global summary</h2><a href=#details>Details</a>
        <p id=details>Three synthetic sites</p><input aria-label="Report filter" value="Retained value"></section>
        <script>document.documentElement.setAttribute('data-theme',localStorage.getItem('theme') || '');</script>
      </body></html>`, { headers: { 'content-type': 'text/html' } })
    }
    if (request.url === 'https://coinstac.org/app-landing-page/') {
      return new Response(landing, { headers: { 'content-type': 'text/html' } })
    }
    if (process.env.LANDING_PAGE_HTML && !request.url.startsWith('https://coinstac.org/report.html')) {
      return net.fetch(request, { bypassCustomProtocolHandlers: true })
    }
    return new Response('<body style="background:white;color:black">Independent report</body>', {
      headers: { 'content-type': 'text/html' },
    })
  })
  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      preload: fileURLToPath(new URL('../../build/preload.js', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const rendererUrl = argument('fixture-url')
  installLandingPageTheme(window.webContents, rendererUrl, () => {
    console.error('Landing-page theme fixture failed to apply styles.')
  })
  installResultReportTheme(window.webContents, rendererUrl, async () => 'https://coinstac.org/run-results', () => {
    console.error('Report-theme fixture failed to synchronize.')
  })
  await window.loadURL(rendererUrl)
})
