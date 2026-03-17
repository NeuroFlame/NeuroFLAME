import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, TextField, Alert, Typography } from '@mui/material'
import { useMutation } from '@apollo/client/react'
import { isValidEmail } from '../../helpers'
import { SIGNUP_MUTATION } from '../../graphql/mutations'
import type { LogInInfo } from '../../graphql/types'

type SignUpData = {
  username: string
  password: string
}

type SignUpResponse = {
  userCreate: LogInInfo
}

interface SignUpFormProps {
  onSuccess: (_: LogInInfo) => void
}

const SignUpForm: React.FC<SignUpFormProps> = ({ onSuccess }) => {
  const [form, setForm] = useState<SignUpData>({ username: '', password: '' })

  const [signUp, { loading, error }] = useMutation<SignUpResponse, SignUpData>(SIGNUP_MUTATION, {
    onCompleted: (res) => {
      setForm({ username: '', password: '' })
      onSuccess(res.userCreate)
    },
  })

  const handleSignUp = useCallback(
    (data: SignUpData) => signUp({ variables: data }),
    [signUp])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.code === 'Enter') {
        event.preventDefault()

        if (isValidEmail(form.username) && form.password) {
          handleSignUp(form)
        }
      }
    }

    document.addEventListener('keydown', listener)

    return () => {
      document.removeEventListener('keydown', listener)
    }
  }, [form, handleSignUp])

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
      <Typography variant='h5' marginBottom={2}>Sign Up</Typography>
      {error && (
        <Alert severity='error' style={{ marginBottom: 8 }}>
          {error?.message || 'Failed to sign up'}
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
        onClick={() => isFormValid && handleSignUp(form)}
        disabled={loading}
        loading={loading}
      >
        Sign Up
      </Button>
    </Box>
  )
}

export default SignUpForm
