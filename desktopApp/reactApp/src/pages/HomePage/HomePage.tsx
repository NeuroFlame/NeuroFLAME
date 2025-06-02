// HomePage.tsx
import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useHomePage } from './useHomePage';

const HomePage: React.FC = () => {
  const { isLoggedIn, logout } = useHomePage(); // Assuming logout is provided by useHomePage
  const navigate = useNavigate();

  return (
    <Box sx={{
      width: "calc(100vw - 2rem)",
      padding: '1rem',
      overflow: 'hidden'
    }}>
      <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        margin: '1rem 0 0 0'
      }} className='home-content-header'>
        <h2>Welcome to NeuroFLAME</h2>
        <Box>
        <Button size='small' variant='outlined' sx={{marginRight: '1rem'}} onClick={() => navigate('/consortium/create')}>Create Consortium</Button>
          <Button size='small' variant='outlined' sx={{marginRight: '1rem'}} onClick={() => navigate('/computation/list')}>View Computation List</Button>
          <Button size='small' variant='contained' onClick={() => navigate('/consortium/list')}>View Consortium List</Button>
        </Box>
      </Box>
      <iframe 
        src="https://coinstac.org/app-landing-page/"
        style={{
          width: "calc(100vw - 2rem)",
          height: "80vh",
          border: 'none'     
        }}
      ></iframe>
    </Box>
  );
};

export default HomePage;
