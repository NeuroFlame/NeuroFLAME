import type { WebContents } from 'electron'

const LANDING_PAGE_URL = 'https://coinstac.org/app-landing-page/'
const STYLE_ID = 'neuroflame-landing-theme'
const COLOR_KEYS = ['page', 'surface', 'text', 'muted', 'border', 'primary', 'error', 'warning'] as const

type LandingPageTheme = {
  mode: 'light' | 'dark';
} & Record<typeof COLOR_KEYS[number], string>

function isLandingPageTheme(value: unknown): value is LandingPageTheme {
  if (!value || typeof value !== 'object') return false
  const theme = value as Record<string, unknown>
  return (theme.mode === 'light' || theme.mode === 'dark') && COLOR_KEYS.every((key) =>
    typeof theme[key] === 'string' && /^#[0-9a-f]{6}$/i.test(theme[key]),
  )
}

function themeScript(theme: LandingPageTheme): string {
  const css = `
    html { color-scheme: dark !important; }
    html, body, .fl-page, .fl-page-content, .fl-row-content-wrap {
      background-color: ${theme.page} !important;
      color: ${theme.text} !important;
    }
    .fl-col-content {
      background-color: ${theme.surface} !important;
      border-color: ${theme.border} !important;
    }
    .fl-rich-text, .fl-rich-text p, .fl-rich-text li, .fl-rich-text strong {
      color: ${theme.muted} !important;
    }
    h1, h2, h3, h4, h5, h6, .fl-heading-text {
      color: ${theme.text} !important;
    }
    a, a .fl-heading-text { color: ${theme.primary} !important; }
    .row-metrics h5, .row-metrics h5 .fl-heading-text { color: ${theme.text} !important; }
    .row-metrics .fl-col:nth-child(1) h2 .fl-heading-text { color: ${theme.error} !important; }
    .row-metrics .fl-col:nth-child(2) h2 .fl-heading-text { color: ${theme.warning} !important; }
    .row-metrics .fl-col:nth-child(3) h2 .fl-heading-text { color: ${theme.primary} !important; }
  `
  // Recheck the destination inside the frame: it may have navigated since selection.
  // Only fixed CSS and validated color values enter this script; no page content is read.
  return `(() => {
    if (location.href !== ${JSON.stringify(LANDING_PAGE_URL)}) return;
    const existing = document.getElementById(${JSON.stringify(STYLE_ID)});
    if (${JSON.stringify(theme.mode)} === 'light') {
      if (existing instanceof HTMLStyleElement) existing.remove();
      return;
    }
    const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
    style.id = ${JSON.stringify(STYLE_ID)};
    style.textContent = ${JSON.stringify(css)};
    if (!style.isConnected) document.head.append(style);
  })()`
}

/** Theme only the hosted home iframe, retaining the page's original light styling. */
export function installLandingPageTheme(
  contents: WebContents,
  rendererUrl: string,
  onError: () => void,
): void {
  let theme: LandingPageTheme | undefined
  const trustedUrl = new URL(rendererUrl)
  trustedUrl.hash = ''
  const isAppFrame = (frameUrl: string) => {
    try {
      const url = new URL(frameUrl)
      url.hash = ''
      return url.href === trustedUrl.href
    } catch {
      return false
    }
  }

  const applyTheme = async () => {
    const currentTheme = theme
    if (!currentTheme || contents.isDestroyed() || !isAppFrame(contents.mainFrame.url)) return
    // Direct children only: report viewers and nested third-party embeds are excluded.
    await Promise.all(contents.mainFrame.frames.map(async (frame) => {
      if (frame.url !== LANDING_PAGE_URL) return
      try {
        await frame.executeJavaScript(themeScript(currentTheme))
      } catch {
        // Navigation/removal can invalidate a frame while an injection is pending.
        onError()
      }
    }))
  }

  const ipc = contents.ipc
  ipc.handle('setLandingPageTheme', async (event, value: unknown) => {
    if (event.senderFrame !== contents.mainFrame || !isAppFrame(contents.mainFrame.url)) {
      throw new Error('Theme changes must originate from the app renderer.')
    }
    if (!isLandingPageTheme(value)) throw new Error('Invalid landing page theme.')
    theme = value
    await applyTheme()
  })
  const onLoad = () => applyTheme().catch(onError)
  contents.on('did-frame-finish-load', onLoad)
  contents.once('destroyed', () => {
    contents.removeListener('did-frame-finish-load', onLoad)
    ipc.removeHandler('setLandingPageTheme')
  })
}
