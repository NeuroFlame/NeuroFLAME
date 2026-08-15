import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid2'
import { useRunDetails } from './useRunDetails'
import { MembersDisplay } from './MembersDisplay'
import ReactMarkdown from 'react-markdown'
import { useCallback, useState } from 'react'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { useUserState } from '../../contexts/UserStateContext'
import { SHARED_SITE_FAILURE_MESSAGE } from '../../apis/edgeApi/getLocalComputationError'

function RunErrorCard({
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

const localErrorMessage = (error: {
  scope?: string | null;
  errorType?: string | null;
  message: string;
}) => [
  error.scope ? `[${error.scope}]` : '',
  error.errorType ? `${error.errorType}:` : '',
  error.message,
].filter(Boolean).join(' ')

function RunDeleteModal({
  open,
  onClose,
  onDelete,
  consortiumName,
  isDeleting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  consortiumName: string;
  isDeleting: boolean;
  error: string;
}) {
  const [confirmName, setConfirmName] = useState<string>('')

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        Are you sure you want to delete this run result?
      </DialogTitle>
      <DialogContent>
        <Typography mb={2}>
          This action is irreversible.{' '}
          Please type <strong>{consortiumName}</strong> to confirm deletion.
        </Typography>
        <TextField
          fullWidth
          placeholder='Consortium Name'
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
        />
        {error && <Alert severity='error'>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          onClick={onDelete}
          disabled={confirmName !== consortiumName || isDeleting}
          color='error'
          variant='contained'
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function RunDetails() {
  const navigate = useNavigate()
  const { runDetails, loading, error, localComputationError } = useRunDetails()
  const { runDelete } = useCentralApi()
  const { userId } = useUserState()

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [deleteError, setDeleteError] = useState<string>('')

  const userToMember = useCallback((user: any) => ({
    id: user.id,
    username: user.username,
    vault: user.vault
      ? {
          name: user.vault.name,
          description: user.vault.description,
        }
      : undefined,
  }), [])

  const hostedVaultToMember = useCallback((vault: any) => ({
    id: vault.id,
    username: vault.name,
    vault: {
      name: vault.name,
      description: vault.description,
    },
  }), [])

  const runId = runDetails?.runId
  const isLeader = runDetails?.consortium.leader.id === userId

  const handleDelete = useCallback(async () => {
    if (!runId) return
    setIsDeleting(true)
    setDeleteError('')

    try {
      await runDelete({ runId })
      setIsDeleteModalOpen(false)
      navigate('/run/list')
    } catch (err) {
      setDeleteError('Failed to delete run.')
    } finally {
      setIsDeleting(false)
    }
  }, [runId, runDelete])

  return (
    <Box p={2}>
      {runDetails && (
        <Box>
          <Box
            display='flex'
            justifyContent='space-between'
            marginLeft='1rem'
            marginRight='1rem'
          >
            <Typography variant='h4'>
              Run Details
            </Typography>
            <Box>
              <Button
                variant='contained'
                color='primary'
                style={{ marginRight: '1rem' }}
                onClick={() => navigate(`/consortium/details/${runDetails.consortium.id}`)}
              >
                View Consortium
              </Button>
              {runDetails.status === 'Complete' && (
                <>
                  <Button
                    variant='contained'
                    color='success'
                    style={{ marginRight: '1rem' }}
                    onClick={() => navigate(`/run/results/${runDetails.consortium.id}/${runDetails.runId}`)}
                  >
                    View Run Results
                  </Button>

                  {isLeader && (
                    <Button variant='contained' color='error' onClick={() => setIsDeleteModalOpen(true)}>
                      Delete
                    </Button>
                  )}
                </>
              )}
            </Box>
          </Box>
          <Grid container spacing={2} padding={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box p={2} borderRadius={2} bgcolor='white'>
                <Typography variant='body1'>
                  <strong>Consortium:</strong>{' '}
                  {runDetails.consortium.title} ({runDetails.consortium.id})
                </Typography>
                <Typography variant='body1'>
                  <strong>Status:</strong> {runDetails.status}
                </Typography>
                <Typography variant='body1'>
                  <strong>Created At:</strong>{' '}
                  {new Date(+runDetails.createdAt).toLocaleString()}
                </Typography>
                <Typography variant='body1'>
                  <strong>Last Updated:</strong>{' '}
                  {new Date(+runDetails.lastUpdated).toLocaleString()}
                </Typography>
              </Box>
            </Grid>
            {/* Members */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <MembersDisplay
                members={[
                  ...runDetails.members.map(userToMember),
                  ...(runDetails.vaultMembers ?? []).map(hostedVaultToMember),
                ]}
                activeMembers={[
                  ...runDetails.consortium.activeMembers.map(userToMember),
                  ...(runDetails.consortium.activeVaultMembers ?? []).map(hostedVaultToMember),
                ]}
                readyMembers={[
                  ...runDetails.consortium.readyMembers.map(userToMember),
                  ...(runDetails.consortium.readyVaultMembers ?? []).map(hostedVaultToMember),
                ]}
                leader={userToMember(runDetails.consortium.leader)}
              />
            </Grid>
            {/* Errors */}
            {(runDetails.runErrors.length > 0 || localComputationError) && (
              <Grid size={{ sm: 12 }}>
                <Box p={2} borderRadius={2} marginBottom={0} bgcolor='white'>
                  <Typography variant='h6' gutterBottom>
                    Errors
                  </Typography>
                  {runDetails.runErrors.map((error, index) => (
                    <RunErrorCard
                      key={`${error.timestamp}-${index}`}
                      timestamp={error.timestamp}
                      source={error.vault?.name ?? error.user.username}
                      message={
                        localComputationError &&
                        error.user.id === userId &&
                        error.message === SHARED_SITE_FAILURE_MESSAGE
                          ? localErrorMessage(localComputationError)
                          : error.message
                      }
                    />
                  ))}
                  {localComputationError &&
                  !runDetails.runErrors.some((runError) =>
                    runError.user.id === userId &&
                    runError.message === SHARED_SITE_FAILURE_MESSAGE
                  ) && (
                    <RunErrorCard
                      source='Local computation'
                      message={localErrorMessage(localComputationError)}
                    />
                  )}
                </Box>
              </Grid>
            )}
            <Grid size={{ sm: 12 }}>
              <Box p={2} borderRadius={2} marginBottom={0} bgcolor='white'>
                {/* Study Configuration */}
                <Typography variant='h6' gutterBottom>
                  Study Configuration
                </Typography>
                <Box marginBottom={1}>
                  <Typography variant='body1'>
                    <strong>Computation:</strong>{' '}
                    {runDetails.studyConfiguration?.computation?.title}
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant='body1'>
                      <strong>Parameters:</strong>
                    </Typography>
                    <Box marginTop={1}>
                      <pre
                        className='settings'
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                        }}
                      >
                        {safelyRenderJson(
                          runDetails.studyConfiguration.computationParameters,
                        )}
                      </pre>
                    </Box>
                  </Grid>
                  <Grid size={{ sm: 6 }}>
                    <Typography variant='body1'>
                      <strong>Leader Notes:</strong>
                    </Typography>
                    <Box marginTop={1}>
                      <div
                        style={{
                          background: '#EEF2F2',
                          padding: '1rem 1rem 0.5rem',
                        }}
                      >
                        <ReactMarkdown>
                          {runDetails.studyConfiguration.consortiumLeaderNotes}
                        </ReactMarkdown>
                      </div>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>

          {/* Delete Modal */}
          <RunDeleteModal
            consortiumName={runDetails.consortium.title}
            open={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            error={deleteError}
          />
        </Box>
      )}
      {error && <Alert severity='error'>{error}</Alert>}
      {loading && (
        <Typography variant='body1' color='textSecondary'>
          Loading...
        </Typography>
      )}
    </Box>
  )
}

function safelyRenderJson(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch (e) {
    return json
  }
}
