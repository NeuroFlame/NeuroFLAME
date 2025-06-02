import React, { useState } from 'react';
import { AppBar, Toolbar, IconButton, Typography, Drawer, List, ListItem, ListItemText } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link, useLocation } from 'react-router-dom';
import NavDrawer from './NavDrawer';
import UserAvatar from './UserAvatar';
import logoSM from '../assets/neuroflame-logo.png';

interface HeaderProps {
  appUsername: string;
}

const Header: React.FC<HeaderProps> = ({ appUsername }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const toggleDrawer = (open: boolean) => {
    setDrawerOpen(open);
  };

  return (
    <>
      <AppBar position="sticky">

        <Toolbar
          sx={{
            pr: '24px', // keep right padding when drawer closed
            backgroundColor: '#001f70'
          }}
        >
          <Typography
            sx={{ flexGrow: 1 }}
          >
            {location.pathname}
          </Typography>
          <img
            src={logoSM}
            alt="Logo"
            style={{
              marginRight: '5px',
              width: '50px',
              height: '30px',
            }}
          />
          <Typography
            color="inherit"
            sx={{
              fontFamily: 'Lato',
              fontSize: '1.5rem'
            }}
            noWrap
          >
            Neuro<b>FLAME</b>
          </Typography>
          <Link to="/home" style={{ textDecoration: 'none' }}>
            <UserAvatar username={appUsername} />
          </Link>
          <IconButton
            edge="end"
            color="inherit"
            aria-label="menu"
            onClick={() => toggleDrawer(true)}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <NavDrawer open={drawerOpen} onClose={() => toggleDrawer(false)} navSetDrawerOpen={setDrawerOpen} />
    </>
  );
};

export default Header;
