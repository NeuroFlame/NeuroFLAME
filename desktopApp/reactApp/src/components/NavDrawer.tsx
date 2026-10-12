import React from 'react'
import { Drawer, List, ListItem, ListItemText } from '@mui/material'
import { Link, useNavigate } from 'react-router-dom'
import { useUserState } from '../contexts/UserStateContext'

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  navSetDrawerOpen: (...args: any[]) => any;
}

const NavDrawer: React.FC<NavDrawerProps> = ({
  open,
  onClose,
  navSetDrawerOpen,
}) => {
  const { roles, clearUserData } = useUserState()

  const isAdmin = roles.includes('admin')

  const navigate = useNavigate()

  const handleLogout = () => {
    clearUserData()
    navSetDrawerOpen(false)
    navigate('/') // React Router navigation
  }

  return (
    <Drawer
      anchor='right'
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { backgroundColor: 'var(--nf-surface)', color: 'var(--nf-text)' },
      }}
    >
      <List sx={{ '& a': { textDecoration: 'none', color: 'var(--nf-text)' } }}>
        <ListItem
          onClick={() => { navSetDrawerOpen(false) }}
          component={Link}
          to='/home'
        >
          <ListItemText primary='Home' />
        </ListItem>
        <ListItem
          onClick={() => { navSetDrawerOpen(false) }}
          component={Link}
          to='/consortium/list'
        >
          <ListItemText primary='Consortia' />
        </ListItem>
        <ListItem
          onClick={() => { navSetDrawerOpen(false) }}
          component={Link}
          data-testid='runs-list-menu-item'
          to='/run/list'
        >
          <ListItemText primary='Runs' />
        </ListItem>
        <ListItem
          onClick={() => { navSetDrawerOpen(false) }}
          component={Link}
          to='/computation/list'
        >
          <ListItemText primary='Computations' />
        </ListItem>
        <ListItem
          onClick={() => { navSetDrawerOpen(false) }}
          component={Link}
          to='/vaults/list'
        >
          <ListItemText primary='Vaults' />
        </ListItem>
      </List>
      <List
        style={{
          position: 'absolute',
          bottom: 0,
          borderTop: '1px solid var(--nf-border)',
          width: '100%',
          background: 'var(--nf-subtle)',
        }}
        sx={{ '& a': { textDecoration: 'none', color: 'var(--nf-primary)' } }}
      >
        {isAdmin && (
          <ListItem
            onClick={() => { navSetDrawerOpen(false) }}
            component={Link}
            to='/admin'
            data-testid='admin-menu-item'
          >
            <ListItemText primary='Admin' />
          </ListItem>
        )}
        <ListItem
          onClick={() => { navSetDrawerOpen(false) }}
          component={Link}
          to='/appConfig'
        >
          <ListItemText primary='App Config' />
        </ListItem>
        <ListItem
          onClick={() => { navSetDrawerOpen(false) }}
          component={Link}
          to='/appHealth'
        >
          <ListItemText primary='App Health' />
        </ListItem>
        <ListItem
          onClick={() => { handleLogout() }}
          style={{ cursor: 'pointer' }}
        >
          <ListItemText primary='Logout' sx={{ color: 'var(--nf-primary)' }} />
        </ListItem>
      </List>
    </Drawer>
  )
}

export default NavDrawer
