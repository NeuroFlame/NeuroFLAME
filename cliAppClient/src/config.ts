// Central API endpoint resolution.
//
// Precedence: explicit env var > the server a saved session was logged into
// > a persisted `neuroflame configure` value (cliConfig.ts — useful before
// any login exists yet) > hardcoded default. This lets `neuroflame login`
// against a specific deployment "stick" for later commands without having
// to re-export env vars every time, while still letting scripts override
// it per-invocation.
//
// The default points at the real, shared deployment (matching the desktop
// app's own defaultConfig.ts) rather than a local-dev localhost address —
// on purpose: `neuroflame login` should work with zero setup for the common
// case of "I just installed this and want to use the real thing," the same
// way the desktop app already does out of the box. `neuroflame configure`
// is only for pointing at something else (a local dev centralApi, a
// different deployment).

import { loadCliConfig } from './cliConfig.js'

export const DEFAULT_HTTP_URL = 'https://trendscenterdev.org/graphql'
export const DEFAULT_WS_URL = 'wss://trendscenterdev.org/graphql'

export interface ServerUrls {
  httpUrl: string
  wsUrl: string
}

export async function resolveServerUrls(session: ServerUrls | null): Promise<ServerUrls> {
  const cliConfig = await loadCliConfig()
  return {
    httpUrl:
      process.env.NEUROFLAME_HTTP_URL || session?.httpUrl || cliConfig.httpUrl || DEFAULT_HTTP_URL,
    wsUrl: process.env.NEUROFLAME_WS_URL || session?.wsUrl || cliConfig.wsUrl || DEFAULT_WS_URL,
  }
}

// The edge federated client's endpoint is a separate, inherently local
// concern: it's whichever machine is actually running the edge client
// (standalone, or embedded in the desktop app), not centralApi. Precedence:
// explicit --url flag > env var > persisted `neuroflame configure` value
// (cliConfig.ts) > edgeFederatedClient's own shipped default (hostingPort
// 4001 in edgeFederatedClient/src/config/defaultConfig.ts — a dev config
// like configs/electronApp1.json may point it elsewhere, e.g. 3003).
//
// Async because the persisted value requires a file read — negligible cost
// for a CLI (one process per invocation), and worth it: prior to the
// persisted config existing, this had no way to "stick" between shell
// sessions the way resolveServerUrls does via the saved session, which was
// the actual root cause of repeated wrong-port mixups.
export const DEFAULT_EDGE_HTTP_URL = 'http://localhost:4001/graphql'

export async function resolveEdgeUrl(flagUrl: string | undefined): Promise<string> {
  if (flagUrl) return flagUrl
  if (process.env.NEUROFLAME_EDGE_URL) return process.env.NEUROFLAME_EDGE_URL
  const config = await loadCliConfig()
  return config.edgeUrl || DEFAULT_EDGE_HTTP_URL
}

// Matches the desktop app's Config type (desktopApp/electronApp/src/types.ts):
// edgeClientSubscriptionUrl and edgeClientRunResultsUrl are independent
// fields there, not derived — every deployment we've actually seen
// colocates them with the edge HTTP URL's origin (see
// configs/electronApp1.json), so that's the fallback default here, but a
// real deployment that doesn't can override either without touching the
// other. Both take the *already-resolved* edge HTTP URL (not a fresh
// resolveEdgeUrl() call) so a one-off `--url` override on the base edge
// command correctly carries through to the derived default.

export async function resolveEdgeWsUrl(edgeHttpUrl: string): Promise<string> {
  if (process.env.NEUROFLAME_EDGE_WS_URL) return process.env.NEUROFLAME_EDGE_WS_URL
  const config = await loadCliConfig()
  if (config.edgeWsUrl) return config.edgeWsUrl
  return edgeHttpUrl.replace(/^http/, 'ws')
}

export async function resolveEdgeRunResultsUrl(edgeHttpUrl: string): Promise<string> {
  if (process.env.NEUROFLAME_EDGE_RESULTS_URL) return process.env.NEUROFLAME_EDGE_RESULTS_URL
  const config = await loadCliConfig()
  if (config.edgeRunResultsUrl) return config.edgeRunResultsUrl
  return edgeHttpUrl.replace(/\/graphql\/?$/, '/run-results')
}
