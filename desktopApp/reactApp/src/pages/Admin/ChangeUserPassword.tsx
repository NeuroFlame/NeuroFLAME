// ChangeUserPassword.tsx
import { useState } from 'react'
import {
  Box,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material'
import { useCentralApi } from '../../apis/centralApi/centralApi'

export default function ChangeUserPassword() {
  const { adminChangeUserPassword } = useCentralApi()

  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleChangePassword = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      await adminChangeUserPassword({ username, password: newPassword })
      setSuccess(`Password for ${username} was successfully updated.`)
    } catch (err) {
      setError('Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box maxWidth='xs' sx={{ width: '100%' }}>
      <Typography variant='h6' sx={{ mb: 2 }}>
        Change User Password
      </Typography>

      {error && (
        <Alert severity='error' sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity='success' sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <TextField
        label='Username'
        placeholder='Enter username'
        fullWidth
        size='small'
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        disabled={loading}
        sx={{
          '& .MuiInputBase-root': { backgroundColor: 'white' },
          marginBottom: '1rem',
        }}
      />

      <TextField
        label='New Password'
        placeholder='Enter new password'
        type='password'
        fullWidth
        size='small'
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        disabled={loading}
        sx={{
          '& .MuiInputBase-root': { backgroundColor: 'white' },
          marginBottom: '1rem',
        }}
      />

      <Button
        variant='contained'
        color='primary'
        fullWidth
        onClick={handleChangePassword}
        disabled={loading || !username || !newPassword}
      >
        {loading ? <CircularProgress size={24} /> : 'Update Password'}
      </Button>
    </Box>
  )
}
