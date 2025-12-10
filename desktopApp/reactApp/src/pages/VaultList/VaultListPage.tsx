// VaultListPage.tsx

import React, { useState } from 'react'
import {
  Typography,
  Button,
  Box,
  Container,
} from '@mui/material'
import ReplayIcon from '@mui/icons-material/Replay'
import { useNavigate } from 'react-router-dom'
import { useUserState } from '../../contexts/UserStateContext'
import VaultUserList from './VaultUserList'

const VaultListPage: React.FC = () => {
  const navigate = useNavigate()
  const { roles } = useUserState()
  const isAdmin = roles.includes('admin')

  const [refreshSignal, setRefreshSignal] = useState(0)

  const handleRefresh = () => {
    setRefreshSignal((prev) => prev + 1)
  }

  return (
    <Container maxWidth='lg'>
      <Box display='flex' flexDirection='row' marginTop={4} marginBottom={2}>
        <Box flex={1}>
          <Typography variant='h4' gutterBottom align='left'>
            Vault List
          </Typography>
        </Box>
        <Box>
          <Button
            variant='contained'
            color='primary'
            onClick={handleRefresh}
            sx={{ marginBottom: 2, marginRight: 1 }}
            startIcon={<ReplayIcon />}
          >
            Reload
          </Button>

          {isAdmin && (
            <Button
              variant='outlined'
              color='primary'
              onClick={() => navigate('/computation/create/')}
              sx={{ marginBottom: 2, marginRight: 1 }}
            >
              Add Vault
            </Button>
          )}
        </Box>
      </Box>
      <Box sx={{ backgroundColor: 'white', borderRadius: '8px', p: 2 }}>
        <VaultUserList refreshSignal={refreshSignal} />
      </Box>
    </Container>
  )
}

export default VaultListPage