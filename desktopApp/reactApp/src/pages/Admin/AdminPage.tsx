// AdminPage.tsx
import { Box, Typography, Divider } from '@mui/material'
import ChangeUserPassword from './ChangeUserPassword'
import ChangeUserRoles from './ChangeUserRoles'
import VaultStatus from './VaultStatus'

export default function AdminPage() {
  return (
    <Box
      sx={{
        width: '100vw',
        minHeight: '100vh',
        backgroundColor: '#f4f6f8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 4,
      }}
    >
      <Typography variant='h4' sx={{ mb: 4, fontWeight: 'bold' }}>
        Admin Panel
      </Typography>

      <Box
        sx={{
          width: '100%',
          maxWidth: '900px',
          backgroundColor: 'white',
          borderRadius: 2,
          boxShadow: 1,
          padding: 4,
          mb: 4,
        }}
      >
        <Typography variant='h5' sx={{ mb: 2, fontWeight: 'bold' }}>
          Vault Status
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <VaultStatus />
      </Box>

      <Box
        sx={{
          width: '100%',
          maxWidth: '600px',
          backgroundColor: 'white',
          borderRadius: 2,
          boxShadow: 1,
          padding: 4,
          mb: 4,
        }}
      >
        <Typography variant='h5' sx={{ mb: 2, fontWeight: 'bold' }}>
          Change User Password
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <ChangeUserPassword />
      </Box>

      <Box
        sx={{
          width: '100%',
          maxWidth: '600px',
          backgroundColor: 'white',
          borderRadius: 2,
          boxShadow: 1,
          padding: 4,
        }}
      >
        <Typography variant='h5' sx={{ mb: 2, fontWeight: 'bold' }}>
          Change User Roles
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <ChangeUserRoles />
      </Box>
    </Box>
  )
}
