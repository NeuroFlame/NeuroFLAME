import React, { useEffect, useState } from 'react';
import { Box, Button, TextField, Typography, CircularProgress, Alert } from '@mui/material';
import { useLogin } from './useLogin';
import logo from '../../../assets/coinstac-logo.png';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { handleLogin, loading, error } = useLogin();

    useEffect(() => {
        const listener = (event: KeyboardEvent) => {
            if (event.code === "Enter") {
                event.preventDefault();

                if (username && password) {
                    handleLogin(username, password);
                } else {
                    console.error("Username or password is not defined");
                }
            }
        };
        document.addEventListener("keydown", listener);
        return () => {
            document.removeEventListener("keydown", listener);
        };
    }, [username, password]);

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
                        backgroundColor: 'white',
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
                onClick={() => handleLogin(username, password)}
                disabled={loading}
            >
                {loading ? <CircularProgress size={24} /> : 'Log In'}
            </Button>
        </Box>
    );
};


