// VaultStatus.tsx - Admin component for viewing vault health status

import React, { useEffect, useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Collapse,
  IconButton,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { PublicUser } from '../../apis/centralApi/generated/graphql'

// Consider a vault offline if no heartbeat in 90 seconds (3x heartbeat interval)
const OFFLINE_THRESHOLD_MS = 90_000

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

function formatLastSeen(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`
  return date.toLocaleDateString()
}

function isOnline(lastHeartbeat: string): boolean {
  const date = new Date(lastHeartbeat)
  const now = new Date()
  return now.getTime() - date.getTime() < OFFLINE_THRESHOLD_MS
}

interface VaultRowProps {
  vault: PublicUser
}

function VaultRow({ vault }: VaultRowProps) {
  const [expanded, setExpanded] = useState(false)
  const status = vault.vaultStatus
  const online = status ? isOnline(status.lastHeartbeat) : false
  const hasRunningComputations = (status?.runningComputations?.length ?? 0) > 0

  return (
    <>
      <TableRow
        sx={{
          '&:hover': { backgroundColor: '#f5f5f5' },
          backgroundColor: online ? 'inherit' : '#ffebee',
        }}
      >
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {online ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <ErrorIcon color="error" fontSize="small" />
            )}
            <Typography fontWeight="medium">
              {vault.vault?.name || vault.username}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          {online ? (
            <Chip label="Online" size="small" color="success" />
          ) : (
            <Chip label="Offline" size="small" color="error" />
          )}
        </TableCell>
        <TableCell>{status?.version || '-'}</TableCell>
        <TableCell>{status ? formatUptime(status.uptime) : '-'}</TableCell>
        <TableCell>
          {status ? formatLastSeen(status.lastHeartbeat) : 'Never'}
        </TableCell>
        <TableCell>
          {hasRunningComputations ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={`${status!.runningComputations.length} running`}
                size="small"
                color="primary"
              />
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          ) : (
            <Typography color="text.secondary">None</Typography>
          )}
        </TableCell>
      </TableRow>
      {hasRunningComputations && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Running Computations
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Consortium</TableCell>
                      <TableCell>Run ID</TableCell>
                      <TableCell>Running For</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {status!.runningComputations.map((comp) => (
                      <TableRow key={comp.runId}>
                        <TableCell>
                          {comp.consortiumTitle || comp.consortiumId}
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                          >
                            {comp.runId.substring(0, 8)}...
                          </Typography>
                        </TableCell>
                        <TableCell>{formatUptime(comp.runningFor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export default function VaultStatus() {
  const { getVaultUserList } = useCentralApi()
  const [vaults, setVaults] = useState<PublicUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadVaults = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getVaultUserList()
      setVaults(res)
      setLastRefresh(new Date())
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch vault status'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadVaults()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadVaults, 30000)
    return () => clearInterval(interval)
  }, [loadVaults])

  const onlineCount = vaults.filter(
    (v) => v.vaultStatus && isOnline(v.vaultStatus.lastHeartbeat),
  ).length
  const offlineCount = vaults.length - onlineCount

  if (loading && vaults.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={loadVaults}>
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            icon={<CheckCircleIcon />}
            label={`${onlineCount} Online`}
            color="success"
            variant="outlined"
          />
          {offlineCount > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${offlineCount} Offline`}
              color="error"
              variant="outlined"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
          <IconButton onClick={loadVaults} disabled={loading} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {vaults.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No vault users found
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>Vault</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Uptime</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell>Computations</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vaults.map((vault) => (
                <VaultRow key={vault.id} vault={vault} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
