import { useEffect, useState } from 'react';
import { Box, Button, TextField, CircularProgress, Alert } from '@mui/material';
import { useRequestPasswordReset } from './useRequestPasswordReset';

export function RequestPasswordReset({ onChangeFormType }: { onChangeFormType: () => void }) {
    const { handleRequestPasswordReset, loading, error } = useRequestPasswordReset(onChangeFormType);
    const [username, setUsername] = useState('');

    useEffect(() => {
        const listener = (event: KeyboardEvent) => {
            if (event.code === "Enter") {
                event.preventDefault();

                if (username) {
                    handleRequestPasswordReset(username)
                }
            }
        };

        document.addEventListener("keydown", listener);

        return () => {
            document.removeEventListener("keydown", listener);
        };
    }, [username, handleRequestPasswordReset, onChangeFormType]);

    return (
        <Box minWidth={400}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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
            <Box display="flex" gap={1}>
                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={() => username &&handleRequestPasswordReset(username)}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} /> : 'Send token'}
                </Button>
                <Button variant="text" color="primary" fullWidth onClick={onChangeFormType}>I already have a token</Button>
            </Box>
        </Box>
    );
};
