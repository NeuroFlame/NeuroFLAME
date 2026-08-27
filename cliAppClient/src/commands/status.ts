// Diagnostic: what is this CLI actually pointed at right now, where did
// each value come from, and is it reachable? Exists because the same
// wrong-edge-port mixup happened repeatedly before this — an on-demand
// check rather than a gate on every command (see README's "Guided setup"
// section for the reasoning), matching the precedent already set by
// vaultFederatedClient's `neuroflame-vault validate`/`env`.

import { loadSession } from '../session.js'
import { loadCliConfig } from '../cliConfig.js'
import {
  resolveServerUrls,
  resolveEdgeUrl,
  resolveEdgeWsUrl,
  resolveEdgeRunResultsUrl,
  DEFAULT_EDGE_HTTP_URL,
} from '../config.js'
import { describeNetworkError } from '../graphqlClient.js'
import { printJsonOrHuman } from './shared.js'

interface Reachability {
  reachable: boolean
  detail: string
}

// A response — even a GraphQL error or a 404 — means the server is up.
// This checks connectivity, not auth or correctness.
async function checkReachable(url: string): Promise<Reachability> {
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

function mark(r: Reachability): string {
  return r.reachable ? `reachable (${r.detail})` : `NOT reachable (${r.detail})`
}

export async function statusCommand(args: string[]): Promise<void> {
  const session = await loadSession()
  const cliConfig = await loadCliConfig()
  const { httpUrl, wsUrl } = await resolveServerUrls(session)
  const edgeUrl = await resolveEdgeUrl(undefined)
  const edgeWsUrl = await resolveEdgeWsUrl(edgeUrl)
  const edgeResultsUrl = await resolveEdgeRunResultsUrl(edgeUrl)

  const httpSource = process.env.NEUROFLAME_HTTP_URL
    ? 'env var'
    : session
      ? 'saved session'
      : 'default'
  const edgeSource = process.env.NEUROFLAME_EDGE_URL
    ? 'env var'
    : cliConfig.edgeUrl
      ? 'neuroflame configure'
      : 'default'
  const edgeWsSource = process.env.NEUROFLAME_EDGE_WS_URL
    ? 'env var'
    : cliConfig.edgeWsUrl
      ? 'neuroflame configure'
      : 'derived from edge URL'
  const edgeResultsSource = process.env.NEUROFLAME_EDGE_RESULTS_URL
    ? 'env var'
    : cliConfig.edgeRunResultsUrl
      ? 'neuroflame configure'
      : 'derived from edge URL'

  const [central, edge] = await Promise.all([
    checkReachable(httpUrl),
    checkReachable(edgeUrl),
  ])

  if (args.includes('--json')) {
    printJsonOrHuman(true, {
      session: session
        ? { username: session.username, userId: session.userId, roles: session.roles }
        : null,
      centralApi: { httpUrl, wsUrl, source: httpSource, ...central },
      edgeClient: {
        url: edgeUrl,
        source: edgeSource,
        wsUrl: edgeWsUrl,
        wsSource: edgeWsSource,
        resultsUrl: edgeResultsUrl,
        resultsSource: edgeResultsSource,
        ...edge,
      },
    }, '')
    return
  }

  console.log(
    session
      ? `Session: logged in as ${session.username} (roles: ${session.roles.join(', ') || 'none'})`
      : 'Session: not logged in — run `neuroflame login`',
  )

  console.log(`\nCentral API: ${httpUrl}  [${httpSource}]`)
  console.log(`  ${mark(central)}`)
  console.log(`  Subscriptions (${wsUrl}) not checked — assumed reachable if the above is.`)

  console.log(`\nEdge client: ${edgeUrl}  [${edgeSource}]`)
  console.log(`  ${mark(edge)}`)
  console.log(`  Subscriptions: ${edgeWsUrl}  [${edgeWsSource}] (not checked)`)
  console.log(`  Run results: ${edgeResultsUrl}  [${edgeResultsSource}]`)
  if (!edge.reachable && edgeUrl === DEFAULT_EDGE_HTTP_URL) {
    console.log(
      '  This is the hardcoded default, not something set for your setup — ' +
        'if you use `edge` commands, run `neuroflame configure` to point ' +
        'this at your actual edge client and save it.',
    )
  }
}
