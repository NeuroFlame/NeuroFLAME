import { Box } from "@mui/material";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ConsortiumLeaderNotesDisplayProps {
    consortiumLeaderNotes: string;
}

export default function ConsortiumLeaderNotesDisplay({ consortiumLeaderNotes }: ConsortiumLeaderNotesDisplayProps) {
    return (
        <Box sx={{
            height: 'calc(100vh - 36rem)',
            overflow: 'scroll'
            }}>
            {consortiumLeaderNotes && <div>
                <ReactMarkdown children={consortiumLeaderNotes} remarkPlugins={[remarkGfm]} />
            </div>}
        </Box>
    );
}
