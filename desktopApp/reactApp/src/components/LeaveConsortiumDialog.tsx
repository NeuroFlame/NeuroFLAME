import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'

export interface LeaderCandidate {
  id: string
  username: string
}

interface LeaveConsortiumDialogProps {
  open: boolean
  consortiumTitle: string
  isLeader: boolean
  // The other people currently in the consortium; never vaults.
  leaderCandidates: LeaderCandidate[]
  onClose: () => void
  onLeave: (newLeaderId?: string) => Promise<void>
}

const LeaveConsortiumDialog: React.FC<LeaveConsortiumDialogProps> = ({
  open,
  consortiumTitle,
  isLeader,
  leaderCandidates,
  onClose,
  onLeave,
}) => {
  const [newLeaderId, setNewLeaderId] = useState('')
  const [isLeaving, setIsLeaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setNewLeaderId('')
      setIsLeaving(false)
      setError('')
    }
  }, [open])

  const handleLeave = async () => {
    setError('')
    setIsLeaving(true)
    try {
      await onLeave(isLeader ? newLeaderId : undefined)
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to leave the consortium')
    } finally {
      setIsLeaving(false)
    }
  }

  const noCandidates = isLeader && leaderCandidates.length === 0

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='xs'>
      <DialogTitle>Leave {consortiumTitle || 'this consortium'}?</DialogTitle>
      <DialogContent>
        {!isLeader && (
          <Typography>You will need to join or be invited again to take part.</Typography>
        )}
        {isLeader && noCandidates && (
          <Typography>
            You are the leader, and there are no other members in this consortium
            to take over. Invite a member to the consortium, or delete the
            consortium instead.
          </Typography>
        )}
        {isLeader && !noCandidates && (
          <>
            <Typography mb={2}>
              You are the leader. Choose who will lead this consortium after you leave.
            </Typography>
            <FormControl fullWidth>
              <InputLabel id='new-leader-label'>New leader</InputLabel>
              <Select
                labelId='new-leader-label'
                label='New leader'
                value={newLeaderId}
                onChange={(event) => setNewLeaderId(event.target.value)}
              >
                {leaderCandidates.map((candidate) => (
                  <MenuItem key={candidate.id} value={candidate.id}>
                    {candidate.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        )}
        {error && <Alert severity='error' style={{ marginTop: 8 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        {noCandidates ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={isLeaving}>
              Cancel
            </Button>
            <Button
              onClick={handleLeave}
              disabled={isLeaving || (isLeader && !newLeaderId)}
              color='error'
              variant='contained'
            >
              {isLeaving ? 'Leaving...' : 'Leave'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default LeaveConsortiumDialog
