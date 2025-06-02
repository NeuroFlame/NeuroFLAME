import { Box, Typography, IconButton } from "@mui/material";
import { HashLink } from 'react-router-hash-link';
import type { Computation } from "../../../apis/centralApi/generated/graphql";
import { Maybe } from "graphql/jsutils/Maybe";
import ComputationSelect from "./ComputationSelect/ComputationSelect";
import { useConsortiumDetailsContext } from "../ConsortiumDetailsContext";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useState } from "react";
import { Terminal } from "xterm";
import TerminalWindow from "./TerminalWindow";

interface ComputationDisplayProps {
    computation: Maybe<Computation> | undefined;
}

export default function Computation({ computation }: ComputationDisplayProps) {
    const { isLeader, refetch } = useConsortiumDetailsContext();
    const [copied, setCopied] = useState(false);


    if (!computation) {
        return (
            <Box p={2} borderRadius={2} marginBottom={2} bgcolor={'white'}>
                <Typography variant="h6">Computation</Typography>
                <Typography variant="body1">No computation selected</Typography>
                <Box marginTop="1rem">
                    {isLeader && (
                        <ComputationSelect computation={computation} refetch={refetch} />
                    )}
                </Box>
            </Box>
        );
    }

    const { title, imageDownloadUrl } = computation;

    const handleCopy = () => {
        if (imageDownloadUrl) {
            navigator.clipboard.writeText(imageDownloadUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset copy status after 2 seconds
        }
    };

    return (
        <Box p={2} borderRadius={2} marginBottom={2} bgcolor={'white'} position='relative'>
            <Box display="flex" justifyContent="space-between">
                <Box>
                    <Typography variant="h6" gutterBottom>
                        Computation
                    </Typography>
                    <Typography variant="h6" fontWeight="600" color="black" lineHeight="1">{title}</Typography>
                </Box>
                {isLeader && (
                    <Box marginTop='1rem'>
                        <ComputationSelect computation={computation} refetch={refetch} />
                    </Box>
                )}
            </Box>
            <Box>
                <Box marginTop={2} marginBottom={1} display="flex" flexDirection="column" alignItems="flex-start">
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
                            {imageDownloadUrl}
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
                    <Box 
                        sx={{
                            width: '100%',
                        }}
                    >
                        <TerminalWindow command={imageDownloadUrl} />
                    </Box>
                </Box>
                <HashLink id="compnotes-anchor" style={{ fontSize: '0.9rem' }} to="#compnotes">
                    View Computation Notes
                </HashLink>
            </Box>
        </Box>
    );
}
