import React, { useState } from 'react'
import { AppBar, Toolbar, IconButton, Typography } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { Link, useLocation } from 'react-router-dom'
import NavDrawer from './NavDrawer'
import ThemeControls from '../theme/ThemeControls'
import UserAvatar from './UserAvatar'
import logoSM from '../assets/neuroflame-logo.png'

interface HeaderProps {
  appUsername: string;
}

const Header: React.FC<HeaderProps> = ({ appUsername }) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  const toggleDrawer = (open: boolean) => {
    setDrawerOpen(open)
  }

  return (
    <>
      <AppBar position='sticky'>
        <Toolbar
          sx={{
            pr: '24px', // keep right padding when drawer closed
          }}
        >
          <Typography
            sx={{
              flexGrow: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: { xs: 'none', sm: 'block' },
            }}
            noWrap
          >
            {location.pathname}
          </Typography>
          <img
            className='header-logo'
            src={logoSM}
            alt='Logo'
            style={{
              marginRight: '5px',
              width: '50px',
              height: '30px',
            }}
          />
          <Typography
            color='inherit'
            sx={{
              fontFamily: 'Lato',
              fontSize: { xs: '1.25rem', sm: '1.5rem' },
              flexGrow: { xs: 1, sm: 0 },
            }}
            noWrap
          >
            Neuro<b>FLAME</b>
          </Typography>
          <ThemeControls />
          <Link to='/home' style={{ textDecoration: 'none' }}>
            <UserAvatar username={appUsername} />
          </Link>
          <IconButton
            edge='end'
            color='inherit'
            aria-label='menu'
            data-testid='menu-icon'
            onClick={() => toggleDrawer(true)}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <NavDrawer
        open={drawerOpen}
        onClose={() => toggleDrawer(false)}
        navSetDrawerOpen={setDrawerOpen}
      />
    </>
  )
}

export default Header
