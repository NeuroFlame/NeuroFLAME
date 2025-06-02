import React, { useState } from 'react';
import { ListItem, ListItemText, Button, Box, Paper, Typography } from '@mui/material';
import { ConsortiumListItem as ConsortiumListItemType } from '../../apis/centralApi/generated/graphql'; // Import the type
import { useCentralApi } from "../../apis/centralApi/centralApi";
import { useNavigate } from 'react-router-dom';
import { useUserState } from '../../contexts/UserStateContext';

interface ConsortiumListItemProps {
    consortium: ConsortiumListItemType;
    onReload: any;
}

const ConsortiumListItem: React.FC<ConsortiumListItemProps> = ({ consortium, onReload }) => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);

    const { userId } = useUserState();

    const isMember = consortium.members.some(member => member.id === userId);

    const { consortiumJoin, consortiumLeave } = useCentralApi();

    // Handle joining the consortium
    const handleJoin = async () => {
        setLoading(true);
        try {
            await consortiumJoin({ consortiumId: consortium.id });
        } catch (error) {
            console.error("Failed to join the consortium:", error);
        } finally {
            setLoading(false);
            navigate(`/consortium/wizard/${consortium.id}`);
        }
    };

    // Handle leaving the consortium
    const handleLeave = async () => {
        setLoading(true);
        try {
            await consortiumLeave({ consortiumId: consortium.id });
            // You can refetch or update the UI state to reflect the change
        } catch (error) {
            console.error("Failed to leave the consortium:", error);
        } finally {
            setLoading(false);
            onReload();
        }
    };

    return (
        <Box display="flex" flexDirection="row" alignItems="center" style={{background: 'white', padding: '1rem', marginBottom: '1rem'}}>
            <Box flex={1}>
                <a onClick={() => navigate(`/consortium/details/${consortium.id}`)}>
                    <Typography variant="h6">{consortium.title || 'No Title'}</Typography>
                </a>
                <Typography>{consortium.description || 'No Description'}</Typography>
            </Box>
            <Box>
                {isMember && <Button
                    variant="contained"
                    color="success"
                    onClick={() => navigate(`/consortium/details/${consortium.id}`)}
                    disabled={loading}
                    sx={{ ml: 2 }}
                >
                    View
                </Button>}
                <Button
                    variant={isMember ? "outlined" : "contained"}
                    color="primary"
                    onClick={isMember ? handleLeave : handleJoin}
                    disabled={loading}
                    sx={{ ml: 2 }}
                >
                    {loading ? "Loading..." : isMember ? "Leave" : "Join"}
                </Button>
            </Box>
        </Box>
    );
};

export default ConsortiumListItem;
