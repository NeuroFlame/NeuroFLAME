import { useEffect, useState } from "react"
import { Box, Button, Paper, Typography, IconButton, Alert, Menu, MenuItem, Snackbar } from '@mui/material'
import TextareaAutosize from 'react-textarea-autosize'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { electronApi } from "../../apis/electronApi/electronApi"
import { useNavigate } from 'react-router-dom'
import { useUserState } from '../../contexts/UserStateContext'

export function AppConfig() {
    const navigate = useNavigate();
    const { getConfig, getConfigPath, openConfig, applyDefaultConfig, saveConfig, restartApp } = electronApi;
    const { userId } = useUserState();

    // State management
    const [config, setConfig] = useState<string>("")
    const [initialConfig, setInitialConfig] = useState<string>("")
    const [configPath, setConfigPath] = useState<string>("")
    const [isEditing, setIsEditing] = useState<boolean>(false)
    const [restartNotification, setRestartNotification] = useState<boolean>(false)
    const [message, setMessage] = useState<string | null>(null)
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

    // Fetch configuration data
    const fetchAll = async () => {
        const [loadedConfig, loadedConfigPath] = await Promise.all([getConfig(), getConfigPath()])
        const loadedConfigStr = JSON.stringify(loadedConfig, null, 2)
        setConfig(loadedConfigStr)
        setInitialConfig(loadedConfigStr)  // Set baseline for change detection
        setConfigPath(loadedConfigPath)
        setIsEditing(false)
        setRestartNotification(false)
        setMessage(null)
    }

    useEffect(() => {
        fetchAll()
    }, [])

    // Handlers for actions
    const handleOpenConfig = () => openConfig()

    const handleApplyDefaultConfig = async () => {
        await applyDefaultConfig()
        fetchAll()
    }

    const handleSaveConfig = async () => {
        try {
            const parsedConfig = JSON.parse(config)
            await saveConfig(JSON.stringify(parsedConfig))
            setInitialConfig(config)  // Update the initial config baseline
            setMessage("Configuration saved successfully.")
            setRestartNotification(true)  // Enable restart option
            setIsEditing(false)
            
            // Auto-dismiss success message after 3 seconds
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            setMessage("Failed to save configuration. Invalid JSON format.")
        }
    }

    const handleConfigChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setConfig(event.target.value);
    };

    const enterEditMode = () => setIsEditing(true)
    const cancelEditMode = () => {
        setConfig(initialConfig)  // Revert to the original config
        setIsEditing(false)
        setRestartNotification(false)
        setMessage(null)
    }

    // Handlers for menu
    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
    const handleMenuClose = () => setAnchorEl(null)

    return (
        <Paper sx={{ margin: '1rem', padding: '1rem' }}>
            {/* Header Section */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                    <Typography variant="h6">Configuration</Typography>
                    <Typography variant="body2" color="textSecondary"><strong>Config Path:</strong> {configPath}</Typography>
                </Box>
                <Box minWidth={'315px'}>
                    {userId ? 
                        <Button onClick={() => navigate(`/home`)} variant="outlined" style={{marginRight: '0.5rem'}}>Back to Home</Button> :
                        <Button onClick={() => navigate(`/`)} variant="outlined" style={{marginRight: '0.5rem'}}>Back to Login</Button>
                    }
                    <Button
                        startIcon={<EditIcon />}
                        onClick={enterEditMode}
                        color="primary"
                        disabled={isEditing}
                        variant="contained"
                    >
                        Edit Config
                    </Button>
                    <IconButton onClick={handleMenuOpen}>
                        <MoreVertIcon />
                    </IconButton>
                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                        <MenuItem onClick={handleOpenConfig}>Open Config File</MenuItem>
                        <MenuItem onClick={fetchAll}>Re-fetch Config</MenuItem>
                        <MenuItem onClick={handleApplyDefaultConfig}>Apply Default Config</MenuItem>
                    </Menu>
                </Box>
            </Box>

            {/* Config Editor Section */}
            {restartNotification && (
                <Alert
                    severity="info"
                    action={
                        <Button
                            color="primary"
                            size="small"
                            startIcon={<RestartAltIcon />}
                            onClick={restartApp}
                            sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}
                        >
                            Restart App
                        </Button>
                    }
                    sx={{ my: 2 }}
                >
                    Changes saved. Restart the app to apply.
                </Alert>
            )}

            {message && (
                <Snackbar
                    open={Boolean(message)}
                    autoHideDuration={3000}
                    onClose={() => setMessage(null)}
                    message={message}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                />
            )}

            <TextareaAutosize
                value={config}
                onChange={handleConfigChange}
                placeholder="Type here..."
                minRows={3}
                style={{
                    width: 'calc(100% - 1.5rem)',
                    padding: '8px',
                    fontSize: '16px',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                }}
            />

            {/* Action Buttons */}
            <Box display="flex" flexDirection="row" justifyContent="flex-start" mt={2} gap={1}>
                {isEditing && (
                    <>
                        <Button variant="contained" color="primary" onClick={handleSaveConfig}>Save</Button>
                        <Button variant="outlined" color="secondary" onClick={cancelEditMode}>Cancel</Button>
                    </>
                )}
                {/* Persistent Restart App button, enabled only after a successful save */}
                {restartNotification && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<RestartAltIcon />}
                        onClick={restartApp}
                    >
                        Restart App
                    </Button>
                )}
            </Box>
        </Paper>
    )
}
