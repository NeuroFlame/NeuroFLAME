import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, TextField, Alert, Typography } from '@mui/material'
import { useMutation } from '@apollo/client/react'
import { isValidEmail } from '../../helpers'
import { LOGIN_MUTATION } from '../../graphql/mutations'
import type { LogInInfo } from '../../graphql/types'

type LogInData = {
  username: string
  password: string
}

type LogInResponse = {
  login: LogInInfo
}

interface LogInFormProps {
  onSuccess: (_: LogInInfo) => void
}

const LogInForm: React.FC<LogInFormProps> = ({ onSuccess }) => {
  const [form, setForm] = useState<LogInData>({ username: '', password: '' })

  const [logIn, { loading, error }] = useMutation<LogInResponse, LogInData>(LOGIN_MUTATION, {
    onCompleted: (res) => {
      setForm({ username: '', password: '' })
      onSuccess(res.login)
    },
  })

  const handleLogIn = useCallback(
    (data: LogInData) => logIn({ variables: data }),
    [logIn],
  )

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.code === 'Enter') {
        event.preventDefault()

        if (isValidEmail(form.username) && form.password) {
          handleLogIn(form)
        }
      }
    }

    document.addEventListener('keydown', listener)

    return () => {
      document.removeEventListener('keydown', listener)
    }
  }, [form, handleLogIn])

  const isFormValid = useMemo(() =>
    isValidEmail(form.username) && form.password,
  [form])

  return (
    <Box
      sx={{
        width: '100%',
        '@media (min-width: 432px)': {
          width: 400,
        },
      }}
      textAlign='center'
    >
      <Typography variant='h5' marginBottom={2}>Log In</Typography>
      {error && (
        <Alert severity='error' style={{ marginBottom: 8 }}>
          {error?.message || 'Failed to login'}
        </Alert>
      )}
      <TextField
        placeholder='Email'
        value={form.username}
        fullWidth
        size='small'
        onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
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
        value={form.password}
        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
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
        onClick={() => isFormValid && handleLogIn(form)}
        disabled={loading}
        loading={loading}
      >
        Log In
      </Button>
    </Box>
  )
}

export default LogInForm
