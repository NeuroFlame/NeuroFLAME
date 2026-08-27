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

function deriveWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, 'ws')
}

/** Prompts for a URL, checks it live, and either loops or accepts it anyway. */
async function promptUrl(label: string, current: string): Promise<string> {
  let url = current
  for (;;) {
    const answer = await ask(`${label} [${url}]: `)
    if (answer) url = answer

    process.stdout.write(`  checking ${url} ... `)
    const result = await checkReachable(url)

    if (result.reachable) {
      console.log(`reachable (${result.detail})`)
      return url
    }

    console.log(`NOT reachable (${result.detail})`)
    if (await askYesNo('  Use it anyway?', false)) return url
    // Otherwise loop and re-prompt, offering the same value again.
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
      edgeUrl = await promptUrl('Edge client URL', existing.edgeUrl || DEFAULT_EDGE_HTTP_URL)
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
