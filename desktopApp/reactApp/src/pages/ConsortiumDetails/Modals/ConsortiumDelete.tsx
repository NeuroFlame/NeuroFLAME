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
import { NavigateFunction } from 'react-router-dom'

interface ConsortiumDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onNavigate: NavigateFunction;
  consortiumName: string;
}

const ConsortiumDeleteModal: React.FC<ConsortiumDeleteModalProps> = ({
  open,
  onClose,
  onDelete,
  onNavigate,
  consortiumName,
}) => {
  const [confirmName, setConfirmName] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!open) {
      setConfirmName('')
      setError('')
      setIsDeleting(false)
    }
  }, [open])

  const handleDelete = async () => {
    setError('')
    setIsDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch (err) {
      setError((err as any).message || 'Failed to invite this consortium')
    } finally {
      setIsDeleting(false)
      onNavigate('/consortium/list')
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        Are you sure you want to delete this consortium?
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
        {error && <Alert severity='error' style={{ marginTop: 8 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          disabled={confirmName !== consortiumName || isDeleting}
          color='error'
          variant='contained'
        >
          {isDeleting ? 'Deleting...' : 'Submit and Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConsortiumDeleteModal
