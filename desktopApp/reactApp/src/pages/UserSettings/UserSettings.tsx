import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Paper,
  Switch,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import type { McpSettings } from '../../apis/centralApi/mcpSettings'

export default function UserSettings() {
  const navigate = useNavigate()
  const api = useCentralApi()
  const [settings, setSettings] = useState<McpSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setSettings(await api.getMcpSettings())
    } catch {
      setError('Unable to load MCP settings.')
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(() => { load() }, 2_000)
    return () => window.clearInterval(timer)
  }, [])

  const update = async (action: () => Promise<McpSettings>) => {
    setBusy(true)
    setError(null)
    try {
      setSettings(await action())
    } catch {
      setError('Unable to update MCP settings.')
    } finally {
      setBusy(false)
    }
  }

  if (!settings) {
    return <Box p={4}>{error ? <Alert severity='error'>{error}</Alert> : <CircularProgress />}</Box>
  }

  return (
    <Paper sx={{ maxWidth: 900, m: '1rem auto', p: 3 }}>
      <Box display='flex' justifyContent='space-between' alignItems='center'>
        <Typography variant='h4'>User Settings</Typography>
        <Button onClick={() => navigate('/home')}>Back to Home</Button>
      </Box>

      <Typography variant='h5' mt={3}>Agent access (MCP)</Typography>
      <Typography color='text.secondary' mt={1}>
        MCP lets an authenticated agent view NeuroFLAME metadata and request confirmed
        management actions. It never exposes participant datasets, dataset mount paths,
        local computation parameters, run kits, local logs, or raw computation errors.
      </Typography>

      <Alert severity='warning' sx={{ mt: 2 }}>
        Information returned by MCP is sent to your selected agent provider and may be
        retained in chat history. Only connect agent applications you trust.
      </Alert>

      <FormControlLabel
        sx={{ mt: 2, display: 'flex' }}
        control={(
          <Switch
            checked={settings.enabled}
            disabled={busy}
            onChange={(_, enabled) => update(() => api.setMcpEnabled(enabled))}
          />
        )}
        label='Enable MCP for my account'
      />
      <Typography variant='body2' color='text.secondary'>
        Turning this off revokes every connected agent and disables derivative result access.
      </Typography>

      <Alert severity='warning' sx={{ mt: 3 }}>
        This separately allows an agent to request the same deidentified derivative report
        and supported derivative files shown on your NeuroFLAME Results page. Raw datasets,
        dataset paths, run kits, local parameters, and diagnostic logs remain unavailable.
      </Alert>
      <FormControlLabel
        sx={{ mt: 1, display: 'flex' }}
        control={(
          <Switch
            checked={settings.resultsEnabled}
            disabled={busy || !settings.enabled}
            onChange={(_, enabled) => update(() => api.setMcpResultsEnabled(enabled))}
          />
        )}
        label='Allow agents to serialize my deidentified Results-page derivatives'
      />

      <Divider sx={{ my: 3 }} />
      <Typography variant='h6'>Pending agent actions</Typography>
      <Typography variant='body2' color='text.secondary' mt={1}>
        Agent-requested changes run only after you approve the exact operation here.
        Requests expire after two minutes.
      </Typography>
      {settings.pendingWrites.length === 0 ? (
        <Typography color='text.secondary' mt={1}>No actions are awaiting approval.</Typography>
      ) : (
        <List>
          {settings.pendingWrites.map((request) => (
            <ListItem
              key={request.id}
              alignItems='flex-start'
              secondaryAction={(
                <Box display='flex' gap={1}>
                  <Button
                    color='error'
                    disabled={busy}
                    onClick={() => update(async () => {
                      await api.decideMcpWrite(request.id, false)
                      return api.getMcpSettings()
                    })}
                  >
                    Deny
                  </Button>
                  <Button
                    variant='contained'
                    disabled={busy}
                    onClick={() => update(async () => {
                      await api.decideMcpWrite(request.id, true)
                      return api.getMcpSettings()
                    })}
                  >
                    Approve
                  </Button>
                </Box>
              )}
            >
              <ListItemText
                sx={{ pr: 22 }}
                primary={request.summary}
                secondaryTypographyProps={{ component: 'div' }}
                secondary={(
                  <Box>
                    <Typography variant='body2'>Requested by {request.clientName}</Typography>
                    <Typography variant='caption' sx={{ overflowWrap: 'anywhere' }}>
                      Exact operation fingerprint: {request.operationHash}
                    </Typography>
                    {request.preview.map((field) => (
                      <Box key={field.label} mt={1}>
                        <Typography variant='caption' fontWeight='bold'>{field.label}</Typography>
                        <Typography
                          component='pre'
                          variant='body2'
                          sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                        >
                          {field.value}
                        </Typography>
                        {field.fullValue && (
                          <Box component='details' mt={0.5}>
                            <Typography component='summary' variant='caption'>
                              Show the complete value before approving
                            </Typography>
                            <Typography
                              component='pre'
                              variant='body2'
                              sx={{ maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap' }}
                            >
                              {field.fullValue}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography variant='h6'>Connection endpoint</Typography>
      <Typography component='code' sx={{ display: 'block', overflowWrap: 'anywhere', mt: 1 }}>
        {settings.endpoint}
      </Typography>

      <Typography variant='h6' mt={3}>Connected agent clients</Typography>
      {settings.connections.length === 0 ? (
        <Typography color='text.secondary' mt={1}>No active MCP connections.</Typography>
      ) : (
        <List>
          {settings.connections.map((connection) => (
            <ListItem
              key={connection.id}
              secondaryAction={(
                <Button
                  color='error'
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await api.revokeMcpConnection(connection.id)
                      await load()
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Revoke
                </Button>
              )}
            >
              <ListItemText
                primary={connection.clientName}
                secondary={`Last used ${new Date(connection.lastUsedAt).toLocaleString()}`}
              />
            </ListItem>
          ))}
        </List>
      )}
      {error && <Alert severity='error' sx={{ mt: 2 }}>{error}</Alert>}
    </Paper>
  )
}
