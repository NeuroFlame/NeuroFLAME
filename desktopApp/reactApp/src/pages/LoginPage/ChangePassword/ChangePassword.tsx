import { FormEvent, useState } from 'react'
import { Box, Button, TextField, CircularProgress, Alert, Typography } from '@mui/material'
import { useChangePassword } from './useChangePassword'

export function ChangePassword() {
  const { handleChangePassword, loading, error } = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const mismatch = Boolean(confirmPassword) && confirmPassword !== newPassword
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading || !currentPassword || !newPassword || newPassword !== confirmPassword) return
    const saved = await handleChangePassword(currentPassword, newPassword)
    setCurrentPassword('')
    if (saved) {
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <Box component='form' onSubmit={handleSubmit} sx={{ maxWidth: 400, mx: 'auto', p: 2 }}>
      <Typography variant='h5' sx={{ mb: 2 }}>Change password</Typography>
      <Typography variant='body2' sx={{ mb: 2 }}>
        Changing your password signs you out on all devices. Sign in again with your new password.
      </Typography>
      {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
      <TextField
        label='Current password'
        name='currentPassword'
        autoComplete='current-password'
        type='password'
        required
        fullWidth
        size='small'
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        disabled={loading}
        sx={{ mb: 2 }}
      />
      <TextField
        label='New password'
        name='newPassword'
        autoComplete='new-password'
        type='password'
        required
        fullWidth
        size='small'
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        disabled={loading}
        sx={{ mb: 2 }}
      />
      <TextField
        label='Confirm new password'
        name='confirmPassword'
        autoComplete='new-password'
        type='password'
        required
        fullWidth
        size='small'
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={mismatch}
        helperText={mismatch ? 'Passwords do not match.' : ''}
        disabled={loading}
        sx={{ mb: 2 }}
      />
      <Button
        type='submit'
        variant='contained'
        color='primary'
        fullWidth
        disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword}
      >
        {loading ? <CircularProgress size={24} /> : 'Change password'}
      </Button>
    </Box>
  )
}
