import React from 'react'
import { EndpointStatus, StatusState, TerminalDockerStatus } from './types'

const badge = (variant: StatusState | boolean) => {
  const state: StatusState = typeof variant === 'boolean' ? (variant ? 'ok' : 'down') : variant
  const colors = {
    ok: { fg: 'var(--nf-success)', bg: 'var(--nf-success-bg)', border: 'var(--nf-success)', text: 'OK' },
    down: { fg: 'var(--nf-error)', bg: 'var(--nf-error-bg)', border: 'var(--nf-error)', text: 'DOWN' },
    checking: { fg: 'var(--nf-muted)', bg: 'var(--nf-subtle)', border: 'var(--nf-border)', text: 'CHECKING' },
  }[state]

  return {
    style: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      color: colors.fg,
      background: colors.bg,
      border: `1px solid ${colors.border}`,
    },
    text: colors.text,
  }
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '180px 1fr 130px 1fr',
  gap: 12,
  alignItems: 'center',
  padding: '10px 12px',
  borderBottom: '1px solid var(--nf-border)',
}

interface StatusTableProps {
  results: EndpointStatus[];
  dockerStatus: TerminalDockerStatus;
}

const StatusTable: React.FC<StatusTableProps> = ({ results, dockerStatus }) => {
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
    <div style={{ border: '1px solid var(--nf-border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ ...rowStyle, background: 'var(--nf-subtle)', fontWeight: 700 }}>
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
              <div style={{ fontSize: 12, color: 'var(--nf-muted)' }}>{i === 0 ? 'DOCKER' : 'SOCKET'}</div>
            </div>
            <div style={{ overflowWrap: 'anywhere', color: 'var(--nf-muted)' }}>{r.target}</div>
            <div>
              <span style={b.style as React.CSSProperties}>{b.text}</span>
            </div>
            <div
              style={{
                color:
                  r.state === 'ok' ? 'var(--nf-success)' : r.state === 'down' ? 'var(--nf-error)' : 'var(--nf-muted)',
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
              <div style={{ fontSize: 12, color: 'var(--nf-muted)' }}>{r.kind.toUpperCase()}</div>
            </div>
            <div style={{ overflowWrap: 'anywhere', color: 'var(--nf-muted)' }}>{r.target}</div>
            <div>
              <span style={b.style as React.CSSProperties}>{b.text}</span>
              {typeof r.latencyMs === 'number' && (
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--nf-muted)' }}>{r.latencyMs} ms</span>
              )}
            </div>
            <div style={{ color: r.ok ? 'var(--nf-success)' : 'var(--nf-error)' }}>{r.details || ''}</div>
          </div>
        )
      })}
    </div>
  )
}

export default StatusTable
