import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, Container, IconButton, Typography } from "@mui/material";
import { useComputationDetails } from "./useComputationDetails";
import ReactMarkdown from 'react-markdown';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useState } from "react";


export default function ComputationDetails() {
    const navigate = useNavigate();

    const { computationDetails, loading, error } = useComputationDetails();

    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (computationDetails.imageDownloadUrl) {
            navigator.clipboard.writeText(computationDetails.imageDownloadUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset copy status after 2 seconds
        }
    };

    return (
        <Box p={2}>
            {/* Error State */}
            {error && (
                <Box mt={2}>
                    <Alert severity="error">{error}</Alert>
                </Box>
            )}

            {/* Run Details Display */}
            {computationDetails && (
                <Container maxWidth="lg" sx={{marginTop: '1rem'}}>
                    <Box display="flex" justifyContent="space-between" marginLeft="1rem" marginRight="1rem">
                        <Typography variant="h4">
                            Computation Details
                        </Typography>
                        <Box>
                            <Button 
                                variant="outlined" 
                                onClick={() => navigate(`/computation/list/`)}
                            >
                                Back To Computation List
                            </Button>
                        </Box>
                    </Box>
                    <Card style={{margin: '1rem', padding: '2rem'}}>
                        <Typography variant="h5" fontWeight="600" color="black">{computationDetails.title}</Typography>
                        <Typography variant="body2" color="textSecondary">
                            {computationDetails.imageName}
                        </Typography>
                        <Box marginTop={2} display="flex" flexDirection="column" alignItems="flex-start">
                        <Typography>
                            Image Download:
                        </Typography>
                        <Box display="flex" alignItems="center" marginBottom="1rem">
                            <Typography
                                component="code"
                                sx={{
                                    bgcolor: '#f5f5f5',
                                    padding: '4px 8px',
                                    borderRadius: 1,
                                    fontFamily: 'monospace',
                                    fontSize: '0.875rem',
                                    width: 'calc(100% - 2rem)',
                                    lineBreak: 'anywhere'
                                }}
                            >
                                {computationDetails.imageDownloadUrl}
                            </Typography>
                            <IconButton
                                onClick={handleCopy}
                                size="small"
                                aria-label="copy download URL"
                                sx={{ marginLeft: 1 }}
                            >
                                <ContentCopyIcon fontSize="small" />
                            </IconButton>
                            {copied && (
                                <Typography fontSize="0.75rem" color="green" marginLeft={1}>
                                    Copied!
                                </Typography>
                            )}
                        </Box>
                    </Box>
                        <Box marginTop="1rem">
                            <ReactMarkdown>{computationDetails.notes}</ReactMarkdown>
                        </Box>                       
                    </Card>
                </Container>
            )}

            {/* Fallback in case data is undefined and not loading */}
            {!loading && !computationDetails && !error && (
                <Typography variant="body1" color="textSecondary">
                    No run details available.
                </Typography>
            )}
        </Box>
    );
}
