// CreateUser.tsx
import React, { useEffect, useState } from 'react'
import { Box, Button, TextField, CircularProgress, Alert } from '@mui/material'
import { useCreateUser } from './useCreateUser'

export function CreateUser({ userCreated }: { userCreated?: () => void }) {
  const { handleUserCreate, loading, error, success } = useCreateUser()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (success && !error && userCreated) {
      userCreated()
    }
  }, [success, userCreated])

  return (
    <Box width='400px'>
      {error && <Alert severity='error' style={{ marginBottom: '1rem' }}>{error}</Alert>}

      <TextField
        placeholder='Username'
        value={username}
        fullWidth
        size='small'
        onChange={(e) => setUsername(e.target.value)}
        disabled={loading}
        sx={{
          '& .MuiInputBase-root': {
            backgroundColor: 'white',
          },
          '& .MuiInputBase-root input': {
            margin: '0',
          },
          marginBottom: '1rem',
        }}
      />
      <TextField
        placeholder='Password'
        type='password'
        fullWidth
        size='small'
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        sx={{
          '& .MuiInputBase-root': {
            backgroundColor: 'white',
          },
          '& .MuiInputBase-root input': {
            margin: '0',
          },
          marginBottom: '1rem',
        }}
      />
      <Button
        variant='contained'
        color='primary'
        fullWidth
        onClick={() => handleUserCreate(username, password)}
        disabled={loading}
      >
        {loading ? <CircularProgress size={24} /> : 'Create User'}
      </Button>
    </Box>
  )
}
