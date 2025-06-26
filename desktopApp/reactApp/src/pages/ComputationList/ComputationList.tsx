import React from 'react';
import { Paper, List, Typography, Button, Box, CircularProgress, Container } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import { ComputationListItem as ComputationListItemType } from '../../apis/centralApi/generated/graphql'; // Import the type
import ComputationListItem from './ComputationListItem'; // Import the new presentation component
import { useNavigate } from 'react-router-dom';
import { useUserState } from '../../contexts/UserStateContext';

interface ComputationListProps {
    computationList: ComputationListItemType[];
    loading: boolean;
    error: string | null;
    onReload: () => void;
}

const ComputationList: React.FC<ComputationListProps> = ({ computationList, loading, error, onReload }) => {
    const navigate = useNavigate();
    
    const { roles } = useUserState();

    console.log(roles);
    
    const isAdmin = roles.includes('admin');
    // Loading state
    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        );
    }

    // Error state
    if (error) {
        return (
            <Container>
                <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" marginTop={2}>
                    <Button variant="contained" color="primary" onClick={onReload} sx={{ marginBottom: 2 }}>
                        Reload
                    </Button>
                    <Typography variant="h6" color="error" align="center">
                        {error}
                    </Typography>
                </Box>
            </Container>
        );
    }

    // Success state (show list and reload button at the top)
    return (
        <Container maxWidth="lg">
            <Box display="flex" flexDirection="row" marginTop={4} marginBottom={2}>
                <Box flex={1}>
                    <Typography variant="h4" gutterBottom align="left">
                        Computation List
                    </Typography>
                </Box>
                <Box>
                    {isAdmin && <Button variant="outlined" color="primary" onClick={() => navigate('/computation/create/')}  sx={{ marginBottom: 2, marginRight: 1 }}>
                        Add Computation
                    </Button>}
                    <Button variant="contained" color="primary" onClick={onReload} sx={{ marginBottom: 2 }}>
                        Reload
                        <ReplayIcon sx={{fontSize: '1rem'}} />
                    </Button>
                </Box>
            </Box>
            <Box>
                <>
                    {computationList.map((computation, index) => (
                        <ComputationListItem key={index} computation={computation} />
                    ))}
                </>
            </Box>
        </Container>
    );
};

export default ComputationList;
