import { Box, Typography } from '@mui/material'

export function RunErrorCard({
  source,
  timestamp,
  message,
}: {
  source: string;
  timestamp?: string;
  message: string;
}) {
  const [summary, ...detailLines] = message.split('\n')
  const details = detailLines.join('\n').trim()

  return (
    <Box
      borderLeft={4}
      borderColor='error.main'
      borderRadius={1}
      bgcolor='#fff7f7'
      padding={2}
      marginTop={1.5}
      minWidth={0}
    >
      <Box display='flex' flexWrap='wrap' gap={1} marginBottom={1}>
        {timestamp && (
          <Typography variant='caption' color='text.secondary'>
            {new Date(+timestamp).toLocaleString()}
          </Typography>
        )}
        <Typography variant='caption' fontWeight={700} color='error.dark'>
          {source}
        </Typography>
      </Box>
      <Typography
        variant='body2'
        color='error.dark'
        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      >
        {summary}
      </Typography>
      {details && (
        <Box
          component='pre'
          aria-label='Computation error details'
          sx={{
            backgroundColor: 'grey.100',
            borderRadius: 1,
            color: 'text.primary',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            marginBottom: 0,
            marginTop: 1.5,
            maxHeight: 360,
            overflow: 'auto',
            padding: 1.5,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {details}
        </Box>
      )}
    </Box>
  )
}
