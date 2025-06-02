import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Tooltip, Typography } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ConsortiumLeaderNotesDisplay from "./ConsortiumLeaderNotesDisplay";
import ConsortiumLeaderNotesEdit from "./ConsortiumLeaderNotesEdit";
import { useConsortiumLeaderNotes } from "./useConsortiumLeaderNotes";

interface ConsortiumLeaderNotesProps {
    consortiumLeaderNotes: string;
    showAccordion : boolean;
}

export default function ConsortiumLeaderNotes({ consortiumLeaderNotes, showAccordion }: ConsortiumLeaderNotesProps) {

    const { isEditing, handleEdit, handleSave, handleCancel, isLeader } = useConsortiumLeaderNotes(consortiumLeaderNotes);

    return (
        <Box p={2} borderRadius={2}  bgcolor={'white'} marginBottom={0} style={{position: 'relative'}}>
            <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1rem 0'}}>
                <Typography variant="h6" gutterBottom>
                    Leader Notes
                </Typography>
                {/* Only show the Edit button if the user is the leader */}
                {!isEditing && isLeader && (
                    <Button
                        variant="outlined"
                        size="small"
                        color="primary"
                        onClick={handleEdit}
                        style={{position: "absolute", top: '1rem', right: '1rem'}}
                    >
                        Edit
                    </Button>
                )}
            </Box>
            {isEditing ? 
            <ConsortiumLeaderNotesEdit
                consortiumLeaderNotes={consortiumLeaderNotes}
                onSave={handleSave}
                onCancel={handleCancel}
            /> :
                <ConsortiumLeaderNotesDisplay consortiumLeaderNotes={consortiumLeaderNotes} />
            }
        </Box>
    );
}
