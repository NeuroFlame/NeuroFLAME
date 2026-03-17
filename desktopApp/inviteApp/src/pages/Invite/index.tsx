import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client/react'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import { GET_INVITE_INFO_QUERY } from '../../graphql/queries'
import type { GetInviteInfo, GetInviteInfoArgs, LogInInfo } from '../../graphql/types'
import LogInForm from '../../components/forms/LogIn'
import SignUpForm from '../../components/forms/SignUp'
import { CONSORTIUM_JOIN_BY_INVITE_MUTATION } from '../../graphql/mutations'
import { useUser } from '../../context/UserContext'
import { tokenStorage } from '../../auth/token'

const wrapperStyle = {
  sx: {
    padding: '2rem 1rem',
    overflow: 'hidden',
  },
}

export default function Invite() {
  const { inviteToken } = useParams<{ inviteToken: string }>()
  const [formType, setFormType] = useState<'login' | 'signup'>('login')
  const [isJoinedByInvite, setIsJoinedByInvite] = useState<boolean>(false)
  const { user, setUser } = useUser()

  const { data, loading, error } = useQuery<GetInviteInfo, GetInviteInfoArgs>(
    GET_INVITE_INFO_QUERY,
    {
      variables: { inviteToken: inviteToken! },
      skip: !inviteToken,
    },
  )

  const [joinByInvite, { loading: isJoining, error: joinError }] = useMutation(
    CONSORTIUM_JOIN_BY_INVITE_MUTATION,
    {
      onCompleted: () => {
        setIsJoinedByInvite(true)
      },
    },
  )

  const handleJoin = useCallback(
    () => joinByInvite({ variables: { inviteToken } })
    , [joinByInvite, inviteToken])

  const handleSuccess = (logInInfo: LogInInfo) => {
    tokenStorage.set(logInInfo.accessToken)
    setUser({
      userId: logInInfo.userId,
      username: logInInfo.username,
      roles: logInInfo.roles,
    })
  }

  useEffect(() => {
    if (!user) {
      return
    }

    handleJoin()
  }, [user, handleJoin])

  if (loading) {
    return (
      <Box display='flex' justifyContent='center' {...wrapperStyle}>
        <CircularProgress size='3rem' />
      </Box>
    )
  }

  if (error) {
    return (
      <Box {...wrapperStyle}>
        <Alert severity='error'>
          {error?.message || 'Failed to get invite'}
        </Alert>
      </Box>
    )
  }

  if (!data?.getInviteInfo) {
    return null
  }

  if (data.getInviteInfo.isExpired) {
    return (
      <Box {...wrapperStyle}>
        <Alert severity='error'>
          This invite link has expired. Please contact {data.getInviteInfo.leaderName} for a new invite.
        </Alert>
      </Box>
    )
  }

  const renderJoinProcess = () => {
    if (!user) {
      return null
    }

    if (isJoining) {
      return (
        <>
          <Typography variant='h6' style={{ marginBottom: 8 }}>
            Joining consortium now...
          </Typography>
          <CircularProgress size='2rem' />
        </>
      )
    }

    if (joinError) {
      return (
        <>
          <Typography variant='h6'>
            Failed to join consortium
          </Typography>
          {joinError?.message && (
            <Alert severity='error' style={{ marginTop: 8 }}>
              {joinError?.message}
            </Alert>
          )}
          <Button color='primary' variant='text' style={{ marginTop: 8 }} onClick={handleJoin}>
            Retry
          </Button>
        </>
      )
    }

    if (isJoinedByInvite) {
      return (
        <Typography variant='h6'>
          You've been added to {data.getInviteInfo.consortiumName}!
        </Typography>
      )
    }
  }

  const renderAuthForms = () => (
    <>
      {formType === 'login' && <LogInForm onSuccess={handleSuccess} />}
      {formType === 'signup' && <SignUpForm onSuccess={handleSuccess} />}

      <Box
        sx={{
          width: '100%',
          '@media (min-width: 432px)': {
            width: 400,
          },
        }}
        textAlign='center'
      >
        <Button
          variant='text'
          color='primary'
          fullWidth
          onClick={() => setFormType(
            formType === 'signup' ? 'login' : 'signup',
          )}
          sx={{ mt: 2 }}
        >
          {formType === 'signup' ? 'Back to Log In' : 'Back to Sign Up'}
        </Button>
      </Box>
    </>
  )

  return (
    <Box {...wrapperStyle}>
      <Typography variant='body1' textAlign='center'>
        <b>{data.getInviteInfo.leaderName}</b>{' '}
        invites you to join{' '}
        <b>{data.getInviteInfo.consortiumName}</b> on NeuroFLAME
      </Typography>

      <Box textAlign='center' marginTop={2}>
        Download <b>NeuroFLAME</b> to get started.{' '}
        <a
          href='https://github.com/NeuroFlame/NeuroFLAME/releases/latest'
          target='_blank'
          rel='noopener noreferrer'
        >
          Latest Release
        </a>
      </Box>

      <Box
        display='flex'
        flexDirection='column'
        alignItems='center'
        textAlign='center'
        marginTop={4}
      >
        {user ? renderJoinProcess() : renderAuthForms()}
      </Box>
    </Box>
  )
}
