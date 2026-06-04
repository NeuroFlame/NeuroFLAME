// AdminPage.tsx
import { useState, SyntheticEvent } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Container,
} from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import LockResetIcon from '@mui/icons-material/LockReset'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import ChangeUserPassword from './ChangeUserPassword'
import ChangeUserRoles from './ChangeUserRoles'
import VaultStatus from './VaultStatus'

interface TabPanelProps {
  children: React.ReactNode
  value: number
  index: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role='tabpanel'
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </Box>
  )
}

function a11yProps(index: number) {
  return {
    id: `admin-tab-${index}`,
    'aria-controls': `admin-tabpanel-${index}`,
  }
}

export default function AdminPage() {
  const [tab, setTab] = useState(0)

  const handleChange = (_: SyntheticEvent, newValue: number) => {
    setTab(newValue)
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f4f6f8', py: 4 }}>
      <Container maxWidth='lg'>
        <Typography variant='h4' sx={{ mb: 4, fontWeight: 'bold' }}>
          Admin Panel
        </Typography>

        <Paper elevation={1} sx={{ borderRadius: 2 }}>
          <Tabs
            value={tab}
            onChange={handleChange}
            aria-label='Admin sections'
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              px: 2,
            }}
          >
            <Tab icon={<StorageIcon />} iconPosition='start' label='Vault Status' {...a11yProps(0)} />
            <Tab icon={<LockResetIcon />} iconPosition='start' label='User Password' {...a11yProps(1)} />
            <Tab icon={<ManageAccountsIcon />} iconPosition='start' label='User Roles' {...a11yProps(2)} />
          </Tabs>

          <Box sx={{ px: 4, pb: 4 }}>
            <TabPanel value={tab} index={0}>
              <VaultStatus />
            </TabPanel>
            <TabPanel value={tab} index={1}>
              <ChangeUserPassword />
            </TabPanel>
            <TabPanel value={tab} index={2}>
              <ChangeUserRoles />
            </TabPanel>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}
