import { AppBar, IconButton, Toolbar, Typography } from '@mui/material'

import { useUser } from '../context/UserContext'
import logoSM from '../assets/neuroflame-logo.png'
import { Logout } from '@mui/icons-material'

const Header: React.FC = () => {
  const { user, logout } = useUser()

  return (
    <AppBar position='sticky'>
      <Toolbar
        sx={{
          pr: '24px', // keep right padding when drawer closed
          backgroundColor: '#001f70',
        }}
      >
        <img
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
            fontSize: '1.5rem',
            flexGrow: 1,
          }}
          noWrap
        >
          Neuro<b>FLAME</b>
        </Typography>
        {user && (
          <>
            {user.username}
            <IconButton
              edge='end'
              color='inherit'
              aria-label='menu'
              onClick={logout}
            >
              <Logout />
            </IconButton>
          </>
        )}
      </Toolbar>
    </AppBar>
  )
}

export default Header
