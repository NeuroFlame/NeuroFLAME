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
  const { runDetails, loading, error } = useRunDetails()
  const { runDelete } = useCentralApi()
  const { userId } = useUserState()

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [deleteError, setDeleteError] = useState<string>('')

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
                members={runDetails.members}
                activeMembers={runDetails.consortium.activeMembers}
                readyMembers={runDetails.consortium.readyMembers}
                leader={runDetails.consortium.leader}
              />
            </Grid>
            {/* Errors */}
            {runDetails.runErrors.length > 0 && (
              <Grid size={{ sm: 12 }}>
                <Box p={2} borderRadius={2} marginBottom={0} bgcolor='white'>
                  <Typography variant='h6' gutterBottom>
                    Errors
                  </Typography>
                  {runDetails.runErrors.map((error, index) => (
                    <Typography key={index} variant='body2' color='error'>
                      {new Date(+error.timestamp).toLocaleString()}{' '}
                      {error.user.username} - {error.message}
                    </Typography>
                  ))}
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
