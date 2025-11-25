import { EndpointStatus, StatusState, TerminalDockerStatus } from './types'

const badge = (variant: StatusState | boolean) => {
  const state: StatusState = typeof variant === 'boolean' ? (variant ? 'ok' : 'down') : variant
  const colors = {
    ok: { fg: '#0b6', bg: '#e9fff4', border: '#9fefc1', text: 'OK' },
    down: { fg: '#b00', bg: '#ffebeb', border: '#f5bcbc', text: 'DOWN' },
    checking: { fg: '#555', bg: '#f5f7fb', border: '#e0e6f0', text: 'CHECKING' },
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
  borderBottom: '1px solid #eee',
}

interface StatusGridProps {
  results: EndpointStatus[];
  dockerStatus: TerminalDockerStatus;
}

const StatusGrid:React.FC<StatusGridProps> = ({ results, dockerStatus }) => {
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
              <div style={{ fontSize: 12, color: '#888' }}>{i === 0 ? 'DOCKER' : 'SOCKET'}</div>
            </div>
            <div style={{ overflowWrap: 'anywhere', color: '#555' }}>{r.target}</div>
            <div>
              <span style={b.style as React.CSSProperties}>{b.text}</span>
            </div>
            <div
              style={{
                color:
                  r.state === 'ok' ? '#2b7a0b' : r.state === 'down' ? '#8a1c1c' : '#555',
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
  )
}

export default StatusGrid
