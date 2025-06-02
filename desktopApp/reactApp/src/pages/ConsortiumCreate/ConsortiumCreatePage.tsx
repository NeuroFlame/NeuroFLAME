import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import TextareaAutosize from 'react-textarea-autosize';
import { Typography, Button, Box, Container } from '@mui/material';
import { useCentralApi } from "../../apis/centralApi/centralApi";

export default function ConsortiumCreate() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const navigate = useNavigate();
    const { consortiumCreate } = useCentralApi();

    const createAndNavigate = async (navPath: string) => {
        try {
            setError(null);
            setLoading(true);
            const consortiumId = await consortiumCreate({
                title: title,
                description: description
            });
            setLoading(false);
            navigate(`${navPath}/${consortiumId}`);
        } catch (error) {
            setLoading(false);
            setError("Failed to create consortium");
        }
    };

    const createAndWizard = async () => {
        await createAndNavigate('/consortium/wizard');
    };

    const createAndDetails = async () => {
        await createAndNavigate('/consortium/details');
    };

    return (
        <Container maxWidth="lg">
            <Box marginTop={4} marginBottom={2}>
                <Box display="flex" flexDirection="row" justifyContent="space-between" marginBottom={2}>
                    <Typography variant="h4" align="left">
                        Create New Consortium
                    </Typography>
                    <Button variant="outlined" onClick={() => navigate('/consortium/list')}>
                        Back to Consortium List
                    </Button>
                </Box>
                <Box style={{ background: 'white', padding: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{ width: "calc(100% - 2rem)", marginBottom: '1rem' }}
                    />
                    <TextareaAutosize
                        minRows={3}
                        style={{ width: "calc(100% - 2rem)", marginBottom: '0.5rem' }}
                        placeholder="Description"
                        defaultValue={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                    <Box marginTop={2} display="flex" gap={2} alignItems='center'>
                        <Button variant="contained" onClick={createAndWizard} disabled={loading} color="success">
                            {loading ? 'Creating...' : 'Create and Use Wizard'}
                        </Button>
                        <Typography>or</Typography>
                        <Button variant="contained" onClick={createAndDetails} disabled={loading}>
                            {loading ? 'Creating...' : 'Create and View Detail'}
                        </Button>
                    </Box>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    {success && <p style={{ color: 'green' }}>Consortium created successfully!</p>}
                </Box>
            </Box>
        </Container>
    );
}
