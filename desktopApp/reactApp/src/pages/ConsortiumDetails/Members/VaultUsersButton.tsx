// Import necessary modules
import React from 'react';
import { Button, Modal, Box, Typography } from '@mui/material';
import VaultUserList from './VaultUserList';
import CloseIcon from '@mui/icons-material/Close';

// Define the style for the Box component inside the Modal
const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 700,
  height: 333,
  bgcolor: 'background.paper',
  borderRadius: '8px',
  boxShadow: 24,
  p: 2,
};

// Define the VaultUsersButton
const VaultUsersButton = () => {
  // State to control the open/close state of the Modal
  const [open, setOpen] = React.useState(false);

  // Function to open the Modal
  const handleOpen = () => setOpen(true);

  // Function to close the Modal
  const handleClose = () => setOpen(false);

  return (
    <>
      {/* Button to open the Modal */}
      <Button variant="contained" color="primary" onClick={handleOpen} size='small' fullWidth>
        Add Vault
      </Button>

      {/* Modal Component */}
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <Box sx={style}>
          <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <Typography variant="h6">
              Vaults
            </Typography>
            <Button
                onClick={handleClose}
                variant="text"
                color="primary"
              >
              Close
              <CloseIcon />
            </Button>
          </Box>
          <VaultUserList onClose={handleClose}></VaultUserList>
        </Box>
      </Modal>
    </>
  );
};

export default VaultUsersButton;
