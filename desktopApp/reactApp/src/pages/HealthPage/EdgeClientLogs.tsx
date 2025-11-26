import { Alert, Box, Button } from '@mui/material'

interface EdgeClientLogsProps {
  showLogs: boolean;
  logs: string[];
  loading: boolean;
  error?: string | null;
  onToggle: () => void;
  onRefresh: () => void;
}

export const EdgeClientLogs: React.FC<EdgeClientLogsProps> = ({
  showLogs,
  logs,
  loading,
  error,
  onToggle,
  onRefresh,
}) => (
  <Box paddingTop={2}>
    <Box display='flex' gap={1}>
      <Button
        variant='outlined'
        color='primary'
        onClick={onToggle}
      >
        {showLogs ? 'Hide Edge Client Logs' : 'Show Edge Client Logs'}
      </Button>
    </Box>
    {showLogs && (
      <>
        {error && (
          <Alert severity='error' sx={{ marginTop: 2 }}>
            {error}
          </Alert>
        )}
        <pre
          style={{
            width: 'calc(100% - 1.5rem)',
            marginTop: '1rem',
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
          {logs.length ? logs.join('\n') : loading ? 'Loading...' : 'No log lines available'}
        </pre>
      </>
    )}
  </Box>
)

export default EdgeClientLogs
