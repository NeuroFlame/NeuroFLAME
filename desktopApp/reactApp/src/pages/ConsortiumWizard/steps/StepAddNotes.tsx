import { Box } from '@mui/material'; 
import ConsortiumLeaderNotes from "../../ConsortiumDetails/ConsortiumLeaderNotes/ConsortiumLeaderNotes";
import { useConsortiumDetailsContext } from "../../ConsortiumDetails/ConsortiumDetailsContext";

export default function StepAddNotes(){
    const {data: consortiumDetails} = useConsortiumDetailsContext();
    const consortiumLeaderNotes = consortiumDetails?.studyConfiguration?.consortiumLeaderNotes;

    return (
    <Box style={{
        maxWidth: '400px',
        border: '1px solid #eee',
        height: 'calc(100vh - 28rem)',  // Limit height to keep within view
        overflowY: 'scroll',  // Allow vertical scrolling if content exceeds
        padding: 1,
        boxSizing: 'border-box',
    }}>
        <ConsortiumLeaderNotes consortiumLeaderNotes={consortiumLeaderNotes ? consortiumLeaderNotes : ''} showAccordion={false} />
    </Box>)
}