import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useLatestRun } from './useLatestRun'

export function LatestRunDisplay({
  latestRun,
  loading,
  navigateToRunDetails,
  navigateToRunResults,
}: ReturnType<typeof useLatestRun> & {
  navigateToRunDetails: (runId?: string) => void
  navigateToRunResults: (consortiumId?: string, runId?: string) => void
}) {
  if (loading) return <CircularProgress />
  if (!latestRun) return null

  const statusRaw = (latestRun.status || '').toLowerCase()
  const isWindingDown = statusRaw === 'draining'
  const isComplete = statusRaw === 'complete'
  const isError = statusRaw === 'error' || statusRaw === 'failed'

  // Safe meta access
  const meta: any = (latestRun as any)?.meta ?? {}

  console.log('LatestRunDisplay meta:', meta);

  const statusColor = isComplete
    ? '#2FB600'
    : isWindingDown
    ? '#E67300'
    : isError
    ? '#D32F2F'
    : '#0066FF'

  const statusLabel =
    isWindingDown && latestRun.status !== null
      ? `Winding Down`
      : latestRun.status

  return (
    <Box p={2} borderRadius={2} bgcolor='white' mb={2}>
      <Typography variant='h6' gutterBottom>Latest Run</Typography>

      <Box
        p={2}
        borderRadius={2}
        bgcolor='#EEF2F2'
        display='flex'
        justifyContent='space-between'
        alignItems='center'
        sx={{ animation: 'fadeIn 0.3s' }}
      >
        <Stack spacing={0.75}>
          <Typography variant='body1' sx={{ fontWeight: 'bold', color: '#0066FF' }}>
            {latestRun.consortiumTitle}
          </Typography>

          <Stack direction='row' spacing={1} alignItems='center'>
            <Typography variant="body2">
              <strong>Status: </strong>
              <Box component="span" sx={{ fontWeight: 'bold', color: statusColor }}>{statusLabel}</Box>
            </Typography>
            {isWindingDown && <CircularProgress size={12} thickness={4} />}
          </Stack>

          {/* Watcher line (human friendly) */}
          {typeof meta?.phase === 'string' && meta.phase.trim().length > 0 && (
            <Typography variant="body2" color="textSecondary" fontSize="11px">
              <strong>Flare Status:</strong> {meta.phase}
              <br />
              <strong>Server Status:</strong> {meta?.server ?? '—'}
              <br />
              <strong>Clients:</strong> {meta?.clients ?? '—'}
            </Typography>
          )}

          <Typography variant='body2' color='textSecondary' fontSize='11px'>
            <strong>Created At:</strong>{' '}
            {new Date(Number(latestRun.createdAt)).toLocaleString()}<br />
            <strong>Last Updated:</strong>{' '}
            {new Date(Number(latestRun.lastUpdated)).toLocaleString()}<br />
            <span style={{ fontSize: '11px', color: '#aaa' }}>
              {latestRun.runId}
            </span>
          </Typography>
        </Stack>

        <Box mt={2} display='flex' flexDirection='column' alignItems='flex-end'>
          {isComplete && (
            <Button
              size='small'
              variant='contained'
              color='primary'
              sx={{ mb: 1 }}
              onClick={() => navigateToRunResults()}
            >
              Results
            </Button>
          )}
          <Button
            size='small'
            variant='outlined'
            color='primary'
            onClick={() => navigateToRunDetails()}
          >
            Details
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
