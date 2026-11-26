import type { WebContents } from 'electron'

/** Synchronize recognized reports in memory; never rewrite computation artifacts. */
export function installResultReportTheme(
  contents: WebContents,
  rendererUrl: string,
  getResultsBase: () => Promise<string>,
  onError: () => void,
): void {
  let revision = 0
  let current: { url: string; mode: 'light' | 'dark' } | undefined
  const withoutHash = (value: string) => {
    const url = new URL(value)
    url.hash = ''
    return url.href
  }
  const trustedRenderer = withoutHash(rendererUrl)
  const isApp = () => !contents.isDestroyed() && withoutHash(contents.mainFrame.url) === trustedRenderer
  const apply = async () => {
    const theme = current
    if (!theme || !isApp()) return
    await Promise.all(contents.mainFrame.frames.map(async (frame) => {
      if (withoutHash(frame.url) !== theme.url) return
      try {
        // Use fixed DOM operations; do not call computation-defined theme functions.
        await frame.executeJavaScript(`(() => {
          if (location.href.split('#')[0] !== ${JSON.stringify(theme.url)}) return;
          const button = document.querySelector('button#themeBtn.theme-toggle');
          if (!button) return;
          const root = document.documentElement;
          const desired = ${JSON.stringify(theme.mode)} === 'dark' ? 'dark' : '';
          window.neuroflameThemeObserver?.disconnect();
          const update = () => {
            if (root.getAttribute('data-theme') !== desired) root.setAttribute('data-theme', desired);
          };
          update();
          root.style.colorScheme = ${JSON.stringify(theme.mode)};
          button.style.setProperty('display', 'none', 'important');
          const observer = new MutationObserver(update);
          observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
          window.neuroflameThemeObserver = observer;
        })()`)
      } catch {
        onError()
      }
    }))
  }
  const ipc = contents.ipc
  ipc.handle('setResultReportTheme', async (event, value: unknown) => {
    if (event.senderFrame !== contents.mainFrame || !isApp()) {
      throw new Error('Report theme changes must originate from the app renderer.')
    }
    const requestRevision = ++revision
    if (value === null) {
      current = undefined
      return
    }
    if (!value || typeof value !== 'object' || !('url' in value) || typeof value.url !== 'string' ||
        !('mode' in value) || (value.mode !== 'light' && value.mode !== 'dark')) {
      throw new Error('Invalid report theme.')
    }
    const target = new URL(value.url)
    const base = new URL(await getResultsBase())
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== base.origin ||
        target.username || target.password || target.search ||
        !target.pathname.startsWith(`${base.pathname.replace(/\/$/, '')}/`) ||
        !/\.html?$/i.test(target.pathname)) {
      throw new Error('Report theme target must be a configured result HTML file.')
    }
    if (requestRevision !== revision) return
    current = { url: withoutHash(target.href), mode: value.mode }
    await apply()
  })
  const onLoad = () => apply().catch(onError)
  contents.on('did-frame-finish-load', onLoad)
  contents.once('destroyed', () => {
    contents.removeListener('did-frame-finish-load', onLoad)
    ipc.removeHandler('setResultReportTheme')
  })
}
