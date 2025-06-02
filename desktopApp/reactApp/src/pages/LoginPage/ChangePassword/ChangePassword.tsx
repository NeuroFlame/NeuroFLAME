// ChangePassword.tsx
import React, { useState } from 'react';
import { Box, Button, TextField, CircularProgress, Alert } from '@mui/material';
import { useChangePassword } from './useChangePassword';

export function ChangePassword() {
    const { handleChangePassword, loading, error } = useChangePassword();
    const [newPassword, setNewPassword] = useState('');

    return (
        <Box maxWidth="xs">
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
                placeholder="New Password"
                type="password"
                fullWidth
                size="small"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                sx={{
                    '& .MuiInputBase-root': {
                        backgroundColor: 'white'
                    },
                    '& .MuiInputBase-root input': {
                        margin: '0'
                    },
                    marginBottom: '1rem'
                }}
            />
            <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => handleChangePassword(newPassword)}
                disabled={loading}
            >
                {loading ? <CircularProgress size={24} /> : 'Change Password'}
            </Button>
        </Box>
    );
}
