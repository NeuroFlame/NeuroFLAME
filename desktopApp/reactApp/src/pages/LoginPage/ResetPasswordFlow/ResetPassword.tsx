import { useEffect, useState } from 'react';
import { Box, Button, TextField, CircularProgress, Alert } from '@mui/material';
import { useResetPassword } from './useResetPassword';

export function ResetPassword({ onChangeFormType }: { onChangeFormType: () => void }) {
    const { handleResetPassword, loading, error } = useResetPassword();
    const [newPassword, setNewPassword] = useState('');
    const [token, setToken] = useState('');

    const isFormValid = newPassword && token;

    useEffect(() => {
        const listener = (event: KeyboardEvent) => {
            if (event.code === "Enter") {
                event.preventDefault();

                if (isFormValid) {
                    handleResetPassword(newPassword, token)
                }
            }
        };

        document.addEventListener("keydown", listener);

        return () => {
            document.removeEventListener("keydown", listener);
        };
    }, [newPassword, token, isFormValid, handleResetPassword]);

    return (
        <Box minWidth={400}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
                placeholder="New Password"
                type="password"
                value={newPassword}
                fullWidth
                size="small"
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
            <TextField
                placeholder="Token"
                value={token}
                fullWidth
                size="small"
                onChange={(e) => setToken(e.target.value)}
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
                    onClick={() => isFormValid && handleResetPassword(newPassword, token)}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} /> : 'Reset Password'}
                </Button>
                <Button variant="text" color="primary" fullWidth onClick={onChangeFormType}>Resend Email</Button>
            </Box>
        </Box>
    );
};
