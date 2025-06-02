import React from 'react';
import { Drawer, List, ListItem, ListItemText } from '@mui/material';
import { Link } from 'react-router-dom';
import { useUserState } from '../contexts/UserStateContext';
import { useNavigate } from "react-router-dom";

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  navSetDrawerOpen: (...args: any[]) => any;
}

const NavDrawer: React.FC<NavDrawerProps> = ({ open, onClose, navSetDrawerOpen }) => {
  const { roles, username, clearUserData } = useUserState();

  const isAdmin = roles.includes('admin');

  const navigate = useNavigate();

  const handleLogout = () => {
    clearUserData();
    navSetDrawerOpen(false);
    navigate("/"); // React Router navigation
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { backgroundColor: "#001f70", color: "white" },
      }}
    >
      <List sx={{ "& a": { textDecoration: "none", color: "white" } }}>
        <ListItem onClick={() => { navSetDrawerOpen(false) }} component={Link} to="/home">
          <ListItemText primary="Home" />
        </ListItem>
        <ListItem onClick={() => { navSetDrawerOpen(false) }} component={Link} to="/consortium/list">
          <ListItemText primary="Consortia" />
        </ListItem>
        <ListItem onClick={() => { navSetDrawerOpen(false) }} component={Link} to="/run/list">
          <ListItemText primary="Runs" />
        </ListItem>
        <ListItem onClick={() => { navSetDrawerOpen(false) }} component={Link} to="/computation/list">
          <ListItemText primary="Computations" />
        </ListItem>
      </List>
      <List 
        style={{position: 'absolute', bottom: 0, borderTop: '1px solid white', width: '100%', background: '#efefef'}} 
        sx={{ "& a": { textDecoration: "none", color: "#001f70" } }}
      >
        {
          isAdmin && (
            <ListItem onClick={() => { navSetDrawerOpen(false) }} component={Link} to="/admin">
              <ListItemText primary="Admin" />
            </ListItem>
          )
        }
        <ListItem onClick={() => { navSetDrawerOpen(false) }} component={Link} to="/appConfig">
          <ListItemText primary="App Config" />
        </ListItem>
        <ListItem onClick={() => { handleLogout() }} style={{cursor: 'pointer'}}>
          <ListItemText primary="Logout" sx={{ color: "#001f70" }} />
        </ListItem>
      </List>
    </Drawer>
  );
};

export default NavDrawer;