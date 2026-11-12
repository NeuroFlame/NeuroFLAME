import { randomBytes } from 'crypto'
import type { Session, WebFrameMain } from 'electron'
import { isReadOnlyEdgeRequest } from './windowPolicy.js'

// Must match LOCAL_API_KEY_HEADER in edgeFederatedClient/src/api/localApiAccess.ts.
export const EDGE_LOCAL_API_KEY_HEADER = 'X-NeuroFLAME-Local-Key'

/** A per-launch secret that lets the embedded edge client trust only this app's window. */
export const createEdgeLocalApiKey = (): string => randomBytes(32).toString('base64url')

const webSocketProtocols: Record<string, string> = { 'http:': 'ws:', 'https:': 'wss:' }

/** HTTP and WebSocket origins of the configured edge client URLs. */
export const edgeLocalApiOrigins = (urls: string[]): Set<string> => {
  const origins = new Set<string>()
  for (const value of urls) {
    const url = new URL(value)
    origins.add(url.origin)
    const paired = webSocketProtocols[url.protocol] ??
      Object.keys(webSocketProtocols).find((key) => webSocketProtocols[key] === url.protocol)
    if (paired) origins.add(`${paired}//${url.host}`)
  }
  return origins
}

/**
 * Attach the key to requests this session sends to the edge client, so the renderer
 * never handles the secret. Result reports, viewers and downloads get it only for
 * read-only result requests; the edge API itself needs the trusted app frame.
 */
export function installEdgeLocalApiKey(
  session: Session,
  edgeUrls: string[],
  localApiKey: string,
  isTrustedAppFrame: (frame: WebFrameMain | undefined) => boolean,
): void {
  const origins = edgeLocalApiOrigins(edgeUrls)
  // Filter patterns ignore ports; the exact origin check below decides.
  const patterns = Array.from(origins, (origin) => {
    const url = new URL(origin)
    return `${url.protocol}//${url.hostname}/*`
  })
  session.webRequest.onBeforeSendHeaders({ urls: patterns }, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders }
    // Never trust a page-supplied value; only this hook may set the key.
    for (const name of Object.keys(requestHeaders)) {
      if (name.toLowerCase() === EDGE_LOCAL_API_KEY_HEADER.toLowerCase()) delete requestHeaders[name]
    }
    if (
      origins.has(new URL(details.url).origin) &&
      (isReadOnlyEdgeRequest(details.method, details.url) || isTrustedAppFrame(details.frame))
    ) {
      requestHeaders[EDGE_LOCAL_API_KEY_HEADER] = localApiKey
    }
    callback({ requestHeaders })
  })
}
