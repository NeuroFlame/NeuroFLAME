import { type FormEvent, useState } from 'react'
import { Box, Button, TextField, CircularProgress, Alert } from '@mui/material'
import { useLogin } from './useLogin'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const { handleLogin, loading, error } = useLogin()

  const submitLogin = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
      setFormError('Please enter a username and password.')
      return
    }

    setFormError(null)
    await handleLogin(normalizedUsername, password)
  }

  return (
    <Box component='form' width='400px' onSubmit={submitLogin}>
      {formError && <Alert severity='error'>{formError}</Alert>}
      {error && <Alert severity='error'>{error}</Alert>}
      <TextField
        placeholder='Username or Email'
        value={username}
        fullWidth
        size='small'
        onChange={(e) => {
          setUsername(e.target.value)
          if (formError) {
            setFormError(null)
          }
        }}
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
        onChange={(e) => {
          setPassword(e.target.value)
          if (formError) {
            setFormError(null)
          }
        }}
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
        disabled={loading}
        type='submit'
      >
        {loading ? <CircularProgress size={24} /> : 'Log In'}
      </Button>
    </Box>
  )
}
