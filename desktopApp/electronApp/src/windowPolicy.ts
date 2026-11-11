// Decisions for popups and navigations. Result reports are computation output and
// therefore untrusted: they must never reach a window that has the app preload.

const parse = (value: string, base?: string): URL | undefined => {
  try {
    return new URL(value, base)
  } catch {
    return undefined
  }
}

const withoutHash = (value: string): string | undefined => {
  const url = parse(value)
  if (!url) return undefined
  url.hash = ''
  return url.href
}

/** The app renderer uses a hash router, so routes differ only after "#". */
export const isTrustedAppUrl = (trustedUrl: string, value: string): boolean => {
  const candidate = withoutHash(value)
  return candidate !== undefined && candidate === withoutHash(trustedUrl)
}

export const isEdgeResultsUrl = (edgeResultsUrl: string, value: string): boolean => {
  const base = parse(edgeResultsUrl)
  const url = parse(value)
  if (!base || !url || url.origin !== base.origin) return false
  // A results URL without a subpath would scope to the whole origin, including the
  // edge API, so it matches nothing instead.
  const prefix = base.pathname.replace(/\/+$/, '')
  if (!prefix) return false
  return url.pathname.startsWith(`${prefix}/`)
}

const isExternalWebUrl = (url: URL): boolean => url.protocol === 'https:' || url.protocol === 'http:'

export type WindowOpenDecision =
  | { action: 'view-nifti'; url: string }
  | { action: 'download'; url: string }
  | { action: 'results-window'; url: string }
  | { action: 'external'; url: string }
  | { action: 'deny' }

export function decideWindowOpen(
  value: string,
  edgeResultsUrl: string,
  appUrl?: string,
): WindowOpenDecision {
  const url = parse(value)
  const base = parse(edgeResultsUrl)
  if (!url || !base || (appUrl && isTrustedAppUrl(appUrl, url.href))) return { action: 'deny' }

  if (url.origin === base.origin) {
    if (url.pathname === '/nii-viewer') {
      const requested = url.searchParams.get('url')
      const nifti = requested ? parse(requested, url.href) : undefined
      return nifti && isEdgeResultsUrl(edgeResultsUrl, nifti.href)
        ? { action: 'view-nifti', url: nifti.href }
        : { action: 'deny' }
    }
    if (!isEdgeResultsUrl(edgeResultsUrl, url.href)) return { action: 'deny' }
    return url.pathname.includes('/zip/')
      ? { action: 'download', url: url.href }
      : { action: 'results-window', url: url.href }
  }

  return isExternalWebUrl(url) ? { action: 'external', url: url.href } : { action: 'deny' }
}

/**
 * The app window may only move between its own routes; a results window may only
 * move within edge results. Anything else is handled like a popup instead.
 */
export const isAllowedNavigation = (
  value: string,
  { trustedUrl, edgeResultsUrl }: { trustedUrl?: string; edgeResultsUrl: string },
): boolean => trustedUrl ? isTrustedAppUrl(trustedUrl, value) : isEdgeResultsUrl(edgeResultsUrl, value)

/** Result reports may read edge results; only the app window may use the edge API. */
export const isReadOnlyEdgeRequest = (method: string, value: string): boolean => {
  const url = parse(value)
  return method === 'GET' && url !== undefined &&
    (url.pathname.startsWith('/run-results/') || url.pathname.startsWith('/static/') ||
      url.pathname === '/nii-viewer')
}
