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
import { useEffect, useMemo, useState } from 'react'
import { isValidEmail } from '../../../utils/helpers'

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
  const [email, setEmail] = useState<string>('')
  const [isInviting, setIsInviting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!open) {
      setEmail('')
      setError('')
      setIsInviting(false)
    }
  }, [open])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.code === 'Enter') {
        event.preventDefault()

        if (isValidEmail(email)) {
          handleInvite()
        } else {
          console.error('Username or password is not defined')
        }
      }
    }
    document.addEventListener('keydown', listener)
    return () => {
      document.removeEventListener('keydown', listener)
    }
  }, [email])

  const isEmailValid = useMemo(() => isValidEmail(email), [email])

  const handleInvite = async () => {
    setError('')
    setIsInviting(true)
    try {
      await onInvite(email)
      onClose()
    } catch (err) {
      setError((err as any).message || 'Failed to invite the user')
    } finally {
      setIsInviting(false)
    }
  }

  const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError('')
    setEmail(evt.target.value)
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
          placeholder='Email'
          value={email}
          onChange={handleChange}
        />
        {error && <Alert severity='error' style={{ marginTop: 8 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isInviting}>
          Cancel
        </Button>
        <Button
          onClick={handleInvite}
          disabled={!isEmailValid || isInviting}
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
