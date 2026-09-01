// Stepped, interactive setup: central API URL, then (optionally) the local
// edge client URL, each checked live before being accepted, then persisted
// via cliConfig.ts so they stick across shell sessions without env vars.
// Complements `neuroflame status` (checks current state, no side effects)
// — this is the "make sure it's actually right" procedure `status` tells
// you to run when something's misconfigured.

import { ask, askYesNo, closePrompt } from '../utils/prompt.js'
import { loadCliConfig, saveCliConfig } from '../cliConfig.js'
import {
  DEFAULT_HTTP_URL,
  DEFAULT_EDGE_HTTP_URL,
  resolveEdgeWsUrl,
  resolveEdgeRunResultsUrl,
} from '../config.js'
import { describeNetworkError } from '../graphqlClient.js'

async function checkReachable(url: string): Promise<{ reachable: boolean; detail: string }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    })
    return { reachable: true, detail: `HTTP ${response.status}` }
  } catch (error) {
    return { reachable: false, detail: describeNetworkError(error) }
  }
}

// `{ __typename }` succeeds against *any* GraphQL server, centralApi
// included — so checkReachable alone can't tell a real edge client apart
// from a URL that's actually centralApi's, typed into the wrong prompt.
// Caught live: a `configure` run saved the same URL for both, "reachable"
// both times, and the mistake only surfaced much later, deep inside the
// wizard, as a confusing "Cannot query field setMountDir" schema error —
// instead of right here, where it's a one-line fix. getContainerService
// only exists on the edge client's own schema, and requires auth
// (edgeFederatedClient's resolvers.ts), so this asks for it unauthenticated
// on purpose: a real edge client answers with a resolver-level "Not
// authorized" (this check doesn't have a token yet, at `configure` time),
// while anything else — centralApi included — rejects it at the schema
// validation stage, distinguishable by GraphQL's own error code.
async function looksLikeEdgeClient(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ getContainerService }' }),
    })
    const body = (await response.json()) as {
      errors?: { extensions?: { code?: string } }[]
    }
    const rejectedBySchema = body.errors?.some(
      (e) => e.extensions?.code === 'GRAPHQL_VALIDATION_FAILED',
    )
    return !rejectedBySchema
  } catch {
    // A network-level failure here isn't this check's concern —
    // checkReachable already covers that; treat as inconclusive (not a
    // hard "no") rather than pile a second, differently-worded failure
    // message onto the one checkReachable already showed.
    return true
  }
}

function deriveWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, 'ws')
}

/** Prompts for a URL, checks it live, and either loops or accepts it anyway. */
async function promptUrl(
  label: string,
  current: string,
  extraCheck?: (url: string) => Promise<string | null>,
): Promise<string> {
  let url = current
  for (;;) {
    const answer = await ask(`${label} [${url}]: `)
    if (answer) url = answer

    process.stdout.write(`  checking ${url} ... `)
    const result = await checkReachable(url)

    if (!result.reachable) {
      console.log(`NOT reachable (${result.detail})`)
      if (await askYesNo('  Use it anyway?', false)) return url
      continue // re-prompt, offering the same value again
    }

    const warning = await extraCheck?.(url)
    if (!warning) {
      console.log(`reachable (${result.detail})`)
      return url
    }

    console.log(`reachable (${result.detail}), but ${warning}`)
    if (await askYesNo('  Use it anyway?', false)) return url
    // Otherwise loop and re-prompt.
  }
}

export async function configureCommand(): Promise<void> {
  try {
    console.log('NeuroFLAME CLI setup\n')
    const existing = await loadCliConfig()

    console.log('--- Central API ---')
    const httpUrl = await promptUrl('Central API URL', existing.httpUrl || DEFAULT_HTTP_URL)
    const wsUrl = deriveWsUrl(httpUrl)
    console.log(`Subscriptions will use: ${wsUrl}`)

    console.log('\n--- Edge client (only needed for `edge` commands) ---')
    let edgeUrl = existing.edgeUrl
    const wantsEdge = await askYesNo(
      'Configure a local edge client now?',
      Boolean(existing.edgeUrl),
    )
    if (wantsEdge) {
      edgeUrl = await promptUrl(
        'Edge client URL',
        existing.edgeUrl || DEFAULT_EDGE_HTTP_URL,
        async (url) =>
          (await looksLikeEdgeClient(url))
            ? null
            : "this doesn't look like an edge client (no getContainerService field on " +
              'its schema) — commonly means this URL points at centralApi (or some ' +
              'other server) by mistake, not a running edge client',
      )
    }

    await saveCliConfig({ ...existing, httpUrl, wsUrl, edgeUrl })

    console.log('\nSaved.')
    console.log(`  Central API: ${httpUrl}`)
    if (edgeUrl) {
      console.log(`  Edge client: ${edgeUrl}`)
      // These two aren't prompted for separately (they match edgeUrl's
      // origin in every real setup we've seen — see cliConfig.ts) but are
      // independently overridable (NEUROFLAME_EDGE_WS_URL/
      // NEUROFLAME_EDGE_RESULTS_URL, or by hand-editing config.json) if a
      // deployment doesn't colocate them, so show what they resolve to.
      console.log(`    subscriptions: ${await resolveEdgeWsUrl(edgeUrl)}`)
      console.log(`    run results:   ${await resolveEdgeRunResultsUrl(edgeUrl)}`)
    }
    console.log(
      `\nNext: \`neuroflame login${edgeUrl ? ' --connect-edge' : ''}\`. ` +
        'Run `neuroflame status` anytime to re-check this.',
    )
  } finally {
    closePrompt()
  }
}
