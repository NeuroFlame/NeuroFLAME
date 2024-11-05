// CreateUser.tsx
import React, { useState } from 'react';
import { Box, Button, TextField, Typography, CircularProgress, Alert } from '@mui/material';
import { useCreateUser } from './useCreateUser';

export function CreateUser() {
    const { handleUserCreate, loading, error } = useCreateUser();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    return (
        <Box maxWidth="xs">
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
                placeholder="Username"
                value={username}
                fullWidth
                size="small"
                onChange={(e) => setUsername(e.target.value)}
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
            <TextField
                placeholder="Password"
                type="password"
                fullWidth
                size="small"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                onClick={() => handleUserCreate(username, password)}
                disabled={loading}
            >
                {loading ? <CircularProgress size={24} /> : 'Create User'}
            </Button>
        </Box>
    );
}
