import React, { useEffect, useMemo, useState } from 'react'
import { electronApi } from '../../apis/electronApi/electronApi'
import { useTerminalDockerHealth, StatusState } from './useTerminalDockerHealth'
import { Paper, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export type EndpointStatus = {
  kind: 'http' | 'graphql' | 'ws' | 'runResults' | 'docker' | 'socket'
  name: string
  target: string
  ok: boolean
  details?: string
  latencyMs?: number
}

const withTimeout = async <T,>(p: Promise<T>, ms = 4000): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) })
     .catch((e) => { clearTimeout(t); reject(e) })
  })

async function checkGraphQL(name: string, url: string): Promise<EndpointStatus> {
  const start = Date.now()
  try {
    const res = (await withTimeout(fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    }))) as Response
    const ok = res.ok
    const txt = await res.text()
    return { kind: 'graphql', name, target: url, ok, latencyMs: Date.now() - start, details: ok ? 'introspection ok' : txt.slice(0, 200) }
  } catch (err: any) { return { kind: 'graphql', name, target: url, ok: false, details: err?.message } }
}
async function checkWs(name: string, url: string): Promise<EndpointStatus> {
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
async function checkHttp(name: string, url: string): Promise<EndpointStatus> {
  const start = Date.now()
  try {
    const res = (await withTimeout(fetch(url, { method: 'GET' }))) as Response
    return { kind: 'http', name, target: url, ok: res.ok, latencyMs: Date.now() - start, details: `${res.status} ${res.statusText}` }
  } catch (err: any) { return { kind: 'http', name, target: url, ok: false, details: err?.message } }
}
async function checkRunResults(name: string, url: string): Promise<EndpointStatus> {
  const start = Date.now()
  try {
    const res = (await withTimeout(fetch(url, { method: 'HEAD' }))) as Response
    return { kind: 'runResults', name, target: url, ok: res.ok, latencyMs: Date.now() - start, details: `${res.status} ${res.statusText}` }
  } catch (err: any) { return { kind: 'runResults', name, target: url, ok: false, details: err?.message } }
}

const badge = (variant: StatusState | boolean) => {
  let state: StatusState = typeof variant === 'boolean' ? (variant ? 'ok' : 'down') : variant
  const colors = {
    ok:   { fg: '#0b6', bg: '#e9fff4', border: '#9fefc1', text: 'OK' },
    down: { fg: '#b00', bg: '#ffebeb', border: '#f5bcbc', text: 'DOWN' },
    checking: { fg: '#555', bg: '#f5f7fb', border: '#e0e6f0', text: 'CHECKING' },
  }[state]
  return {
    style: { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: colors.fg, background: colors.bg, border: `1px solid ${colors.border}` },
    text: colors.text,
  }
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '180px 1fr 130px 1fr',
  gap: 12, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #eee',
}

export default function HealthPage() {
  const [config, setConfig] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<EndpointStatus[]>([])

  const { ready, status: dockerStatus, runDockerChecks, getLastLines } =
    useTerminalDockerHealth()

  const [showDockerLogs, setShowDockerLogs] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    electronApi.getConfig()
      .then((cfg) => { if (mounted) setConfig(cfg) })
      .catch((e) => setError(e?.message || 'Failed to load config'))
    return () => { mounted = false }
  }, [])

  const urls = useMemo(() => {
    if (!config) return null
    return {
      centralHttp: config.centralServerQueryUrl,
      centralWs: config.centralServerSubscriptionUrl,
      edgeHttp: config.edgeClientQueryUrl,
      edgeWs: config.edgeClientSubscriptionUrl,
      runResults: config.edgeClientRunResultsUrl,
      internalHttp: config?.edgeClientConfig?.httpUrl,
      internalWs: config?.edgeClientConfig?.wsUrl,
    }
  }, [config])

  const run = async () => {
    if (!urls) return
    setLoading(true)
    setError(null)

    try {
      // Start Docker checks immediately; rows will say CHECKING until resolved/timeout
      runDockerChecks()

      const checks: Promise<EndpointStatus>[] = []
      checks.push(checkGraphQL('Central GraphQL (HTTP)', urls.centralHttp))
      //checks.push(checkGraphQL('EdgeClient GraphQL (HTTP)', urls.edgeHttp))
      if (urls.internalHttp) checks.push(checkGraphQL('EdgeClient Internal HTTP', urls.internalHttp))

      checks.push(checkWs('Central GraphQL (WS)', urls.centralWs))
      checks.push(checkWs('EdgeClient GraphQL (WS)', urls.edgeWs))
      if (urls.internalWs) checks.push(checkWs('EdgeClient Internal WS', urls.internalWs))

      //checks.push(checkRunResults('EdgeClient Run Results', urls.runResults))

      const settled = await Promise.allSettled(checks)
      const base = settled.map((s) =>
        s.status === 'fulfilled'
          ? s.value
          : ({ kind: 'http', name: 'unknown', target: '', ok: false, details: (s as any).reason?.message || 'failed' } as EndpointStatus)
      )

      setResults(base)
    } catch (e: any) {
      setError(e?.message || 'Failed to run health checks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (ready && urls) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, !!urls])

  const dockerRowsUi = [
    {
      label: 'Docker CLI',
      state: dockerStatus.cli.state,
      target: dockerStatus.cli.target,
      details: dockerStatus.cli.details,
    },
    {
      label: 'Docker Socket',
      state: dockerStatus.daemon.state,
      target: dockerStatus.daemon.target,
      details: dockerStatus.daemon.details,
    },
  ]

  return (
    <Paper style={{ maxWidth: 1100, margin: '1rem auto', padding: '1rem' }}>
     <Typography variant='h5' style={{ marginBottom: 20 }}>App Health</Typography>
      <p style={{ color: '#666', marginBottom: 20 }}>
        Uses <code className='inline'>electronApi.getConfig()</code> for endpoints. Network checks run in the renderer. Docker rows show <strong>CHECKING</strong> until the terminal confirms OK or times out.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={run}
          disabled={loading || !ready || !urls}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer' }}
        >
          {loading ? 'Running…' : !urls ? 'Loading config…' : !ready ? 'Starting terminal…' : 'Re-run Checks'}
        </button>
                    <button
            style={{
                background: 'none',
                border: '1px solid #06f',
                color: '#06f',
                cursor: 'pointer',
                borderRadius: '0.5rem'
                
            }}
            onClick={() => navigate('/appConfig')}
            >
            App Config
            </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fff5f5', border: '1px solid #f5c2c7', color: '#842029', borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ ...rowStyle, background: '#fafafa', fontWeight: 700 }}>
          <div>Component</div>
          <div>Target</div>
          <div>Status</div>
          <div>Details</div>
        </div>

        {/* Docker rows first (tri-state) */}
        {dockerRowsUi.map((r, i) => {
            const b = badge(r.state)
            return (
            <div key={`docker-${i}`} style={rowStyle}>
                <div>
                <div style={{ fontWeight: 600 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                    {i === 0 ? 'DOCKER' : 'SOCKET'}
                </div>
                </div>
                <div style={{ overflowWrap: 'anywhere', color: '#555' }}>
                {r.target}
                </div>
                <div>
                <span style={b.style as React.CSSProperties}>{b.text}</span>
                </div>
                <div
                style={{
                    color:
                    r.state === 'ok'
                        ? '#2b7a0b'
                        : r.state === 'down'
                        ? '#8a1c1c'
                        : '#555',
                }}
                >
                {r.details || ''}
                </div>
            </div>
            )
        })}

        {/* Network rows */}
        {results.map((r, i) => {
          const b = badge(r.ok)
          return (
            <div key={i} style={rowStyle}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{r.kind.toUpperCase()}</div>
              </div>
              <div style={{ overflowWrap: 'anywhere', color: '#555' }}>{r.target}</div>
              <div>
                <span style={b.style as React.CSSProperties}>{b.text}</span>
                {typeof r.latencyMs === 'number' && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>{r.latencyMs} ms</span>
                )}
              </div>
              <div style={{ color: r.ok ? '#2b7a0b' : '#8a1c1c' }}>{r.details || ''}</div>
            </div>
          )
        })}
      </div>

        {/* Docker logs toggle */}
        <div style={{ padding: '8px 12px' }}>
            <button
            style={{
                fontSize: 12,
                background: 'none',
                border: '1px solid #06f',
                color: '#06f',
                cursor: 'pointer',
                borderRadius: '0.5rem'
                
            }}
            onClick={() => setShowDockerLogs((s) => !s)}
            >
            {showDockerLogs ? 'Hide Docker Logs' : 'Show Docker Logs'}
            </button>
            {showDockerLogs && (
            <pre
                style={{
                marginTop: 8,
                maxHeight: 200,
                overflowY: 'auto',
                background: '#f7f7f7',
                padding: 8,
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 11,
                lineHeight: 1.4,
                color: '#333',
                }}
            >
                {getLastLines(50).join('\n')}
            </pre>
            )}
        </div>

      <p style={{ marginTop: 16, fontSize: 12, color: '#777' }}>
        Tip: On Linux/macOS, Docker socket is usually <code className='inline'>/var/run/docker.sock</code> on Windows it’s <code className='inline'>\\.\pipe\docker_engine</code> Colima/Lima may use different paths.
      </p>
    </Paper>
  )
}
