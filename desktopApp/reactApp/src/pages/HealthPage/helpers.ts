import { EndpointStatus } from './types'

const withTimeout = async <T>(p: Promise<T>, ms = 4000): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) })
      .catch((e) => { clearTimeout(t); reject(e) })
  })

export async function checkGraphQL(name: string, url: string): Promise<EndpointStatus> {
  const start = Date.now()

  try {
    const res = (await withTimeout(fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    }))) as Response
    const ok = res.ok
    const txt = await res.text()
    return {
      kind: 'graphql',
      name,
      target: url,
      ok,
      latencyMs: Date.now() - start,
      details: ok ? 'introspection ok' : txt.slice(0, 200),
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      kind: 'graphql',
      name,
      target: url,
      ok: false,
      details: message,
    }
  }
}

export async function checkWs(name: string, url: string): Promise<EndpointStatus> {
  const start = Date.now()
  return new Promise<EndpointStatus>((resolve) => {
    let settled = false
    const ws = new WebSocket(url)
    const finish = (ok: boolean, details?: string) => {
      if (settled) return; settled = true
      try { ws.close() } catch {}
      resolve({ kind: 'ws', name, target: url, ok, latencyMs: Date.now() - start, details })
    }
    const to = setTimeout(() => finish(false, 'timeout'), 4000)
    ws.addEventListener('open', () => { clearTimeout(to); finish(true, 'connected') })
    ws.addEventListener('error', () => { clearTimeout(to); finish(false, 'error') })
  })
}

export async function checkHttp(name: string, url: string): Promise<EndpointStatus> {
  const start = Date.now()
  try {
    const res = (await withTimeout(fetch(url, { method: 'GET' }))) as Response
    return {
      kind: 'http',
      name,
      target: url,
      ok: res.ok,
      latencyMs: Date.now() - start,
      details: `${res.status} ${res.statusText}`,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      kind: 'http',
      name,
      target: url,
      ok: false,
      details: message,
    }
  }
}

export async function checkRunResults(name: string, url: string): Promise<EndpointStatus> {
  const start = Date.now()
  try {
    const res = (await withTimeout(fetch(url, { method: 'HEAD' }))) as Response
    return {
      kind: 'runResults',
      name,
      target: url,
      ok: res.ok,
      latencyMs: Date.now() - start,
      details: `${res.status} ${res.statusText}`,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      kind: 'runResults',
      name,
      target: url,
      ok: false,
      details: message,
    }
  }
}
