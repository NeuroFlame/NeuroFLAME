import { Box, Button } from '@mui/material'

interface DockerLogsProps {
  showLogs: boolean;
  logs: string[];
  onToggle: () => void;
}

const DockerLogs: React.FC<DockerLogsProps> = ({ showLogs, logs, onToggle }) => (
  <Box paddingTop={2}>
    <Button
      variant='outlined'
      color='primary'
      onClick={onToggle}
    >
      {showLogs ? 'Hide Docker Logs' : 'Show Docker Logs'}
    </Button>
    {showLogs && (
      <pre
        style={{
          width: 'calc(100% - 1.5rem)',
          marginTop: '1rem',
          maxHeight: 200,
          overflowY: 'auto',
          background: 'var(--nf-subtle)',
          padding: 8,
          border: '1px solid var(--nf-border)',
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.4,
          color: 'var(--nf-text)',
        }}
      >
        {logs.join('\n')}
      </pre>
    )}
  </Box>
)

export default DockerLogs
