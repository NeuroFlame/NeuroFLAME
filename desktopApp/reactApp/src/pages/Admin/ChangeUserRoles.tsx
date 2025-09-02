// ChangeUserRoles.tsx
import { useState } from 'react'
import {
  Box,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material'
import { useCentralApi } from '../../apis/centralApi/centralApi'

export default function ChangeUserRoles() {
  const { adminChangeUserRoles } = useCentralApi()

  const [username, setUsername] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const availableRoles = ['admin', 'user'] // Example roles, customize as needed

  const handleRolesChange = (event: SelectChangeEvent<string[]>) => {
    setRoles(event.target.value as string[])
  }

  const handleChangeRoles = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      await adminChangeUserRoles({ username, roles })
      setSuccess(`Roles for ${username} were successfully updated.`)
    } catch (err) {
      setError('Failed to update roles. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box maxWidth='xs' sx={{ width: '100%' }}>
      <Typography variant='h6' sx={{ mb: 2 }}>Change User Roles</Typography>

      {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity='success' sx={{ mb: 2 }}>{success}</Alert>}

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

      <FormControl fullWidth sx={{ marginBottom: '1rem' }}>
        <InputLabel id='roles-label'>Roles</InputLabel>
        <Select
          labelId='roles-label'
          multiple
          value={roles}
          onChange={handleRolesChange}
          input={<OutlinedInput id='select-multiple-chip' label='Roles' />}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((value) => (
                <Chip key={value} label={value} />
              ))}
            </Box>
          )}
          disabled={loading}
        >
          {availableRoles.map((role) => (
            <MenuItem key={role} value={role}>
              {role}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button
        variant='contained'
        color='primary'
        fullWidth
        onClick={handleChangeRoles}
        disabled={loading || !username || roles.length === 0}
      >
        {loading ? <CircularProgress size={24} /> : 'Update Roles'}
      </Button>
    </Box>
  )
}
