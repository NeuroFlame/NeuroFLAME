import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'

interface ConsortiumInviteModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (_: string) => Promise<void>;
}

const ConsortiumInviteModal: React.FC<ConsortiumInviteModalProps> = ({
  open,
  onClose,
  onInvite,
}) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState<string>('')
  const [isInviting, setIsInviting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!open) {
      setUsernameOrEmail('')
      setError('')
      setIsInviting(false)
    }
  }, [open])

  const handleInvite = async (usernameOrEmail: string) => {
    setError('')
    setIsInviting(true)
    try {
      await onInvite(usernameOrEmail)
      onClose()
    } catch (err) {
      setError((err as any).message || 'Failed to invite the user')
    } finally {
      setIsInviting(false)
    }
  }

  const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError('')
    setUsernameOrEmail(evt.target.value)
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        Are you sure you want to invite a user to this consortium?
      </DialogTitle>
      <DialogContent>
        <Typography mb={2}>
          Please type <strong>Username</strong> or <strong>Email</strong>.
        </Typography>
        <TextField
          fullWidth
          placeholder='Username or Email'
          value={usernameOrEmail}
          onChange={handleChange}
        />
        {error && <Alert severity='error' style={{ marginTop: 8 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isInviting}>
          Cancel
        </Button>
        <Button
          onClick={() => handleInvite(usernameOrEmail)}
          disabled={isInviting}
          color='error'
          variant='contained'
        >
          {isInviting ? 'Inviting...' : 'Invite'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConsortiumInviteModal
