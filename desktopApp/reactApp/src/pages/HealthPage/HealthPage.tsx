import { Box, Button, Paper, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { electronApi, Config } from '../../apis/electronApi/electronApi'
import DockerLogs from './DockerLogs'
import StatusTable from './StatusTable'
import { useTerminalDockerHealth } from './hooks/useTerminalDockerHealth'
import { checkGraphQL, checkWs } from './helpers'
import { EndpointStatus } from './types'
import EdgeClientLogs from './EdgeClientLogs'
import { useEdgeClientLogs } from './hooks/useEdgeClientLogs'

export default function HealthPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<EndpointStatus[]>([])

  const { ready, status: dockerStatus, runDockerChecks, getLastLines } =
    useTerminalDockerHealth()

  const [showDockerLogs, setShowDockerLogs] = useState<boolean>(false)
  const [showEdgeLogs, setShowEdgeLogs] = useState<boolean>(false)

  const navigate = useNavigate()
  const {
    lines: edgeLogs,
    loading: edgeLogsLoading,
    error: edgeLogsError,
    getLogs: refreshEdgeLogs,
  } = useEdgeClientLogs()

  useEffect(() => {
    if (showEdgeLogs) {
      refreshEdgeLogs()
    }
  }, [showEdgeLogs, refreshEdgeLogs])

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

  const run = useCallback(async () => {
    if (!urls) return
    setLoading(true)
    setError(null)

    try {
      // Start Docker checks immediately; rows will say CHECKING until resolved/timeout
      runDockerChecks()

      const checks: Promise<EndpointStatus>[] = []
      checks.push(checkGraphQL('Central GraphQL (HTTP)', urls.centralHttp))
      // checks.push(checkGraphQL('EdgeClient GraphQL (HTTP)', urls.edgeHttp))
      if (urls.internalHttp) checks.push(checkGraphQL('EdgeClient Internal HTTP', urls.internalHttp))

      checks.push(checkWs('Central GraphQL (WS)', urls.centralWs))
      checks.push(checkWs('EdgeClient GraphQL (WS)', urls.edgeWs))
      if (urls.internalWs) checks.push(checkWs('EdgeClient Internal WS', urls.internalWs))

      // checks.push(checkRunResults('EdgeClient Run Results', urls.runResults))

      const settled = await Promise.allSettled(checks)
      const base = settled.map((s) =>
        s.status === 'fulfilled'
          ? s.value
          : ({
              kind: 'http',
              name: 'unknown',
              target: '',
              ok: false,
              details: s.status === 'rejected' && s.reason instanceof Error ? s.reason.message : 'failed',
            } as EndpointStatus),
      )

      setResults(base)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to run health checks'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [urls, runDockerChecks])

  useEffect(() => {
    if (ready && urls) run()
  }, [ready, urls, run])

  return (
    <Paper style={{ maxWidth: 1100, margin: '1rem auto', padding: '1rem' }}>
      <Typography variant='h5' marginBottom={2}>App Health</Typography>

      <Box
        display='flex'
        justifyContent='space-between'
        alignItems='center'
        marginBottom={2}
      >
        <Button
          variant='contained'
          color='primary'
          onClick={run}
          disabled={loading || !ready || !urls}
        >
          {loading ? 'Running…' : !urls ? 'Loading config…' : !ready ? 'Starting terminal…' : 'Re-run Checks'}
        </Button>
        <Button
          variant='outlined'
          onClick={() => navigate('/appConfig')}
        >
          App Config
        </Button>
      </Box>

      {error && (
        <Box
          padding={1.5}
          borderRadius={1.5}
          marginBottom={2}
          border='1px solid #f5c2c7'
          bgcolor='#fff5f5'
          color='#842029'
        >
          {error}
        </Box>
      )}

      <StatusTable
        results={results}
        dockerStatus={dockerStatus}
      />

      <DockerLogs
        showLogs={showDockerLogs}
        logs={getLastLines(50)}
        onToggle={() => setShowDockerLogs((s) => !s)}
      />

      <EdgeClientLogs
        showLogs={showEdgeLogs}
        logs={edgeLogs}
        loading={edgeLogsLoading}
        error={edgeLogsError}
        onToggle={() => setShowEdgeLogs((s) => !s)}
        onRefresh={refreshEdgeLogs}
      />
    </Paper>
  )
}
