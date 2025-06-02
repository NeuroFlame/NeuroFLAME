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
        <Box p={2} borderRadius={2}  bgcolor={'white'} marginBottom={0}>
            <Accordion sx={{margin: '0', padding: '0', boxShadow: 'none'}} defaultExpanded>
            <AccordionSummary 
                sx={{
                    margin: '0', 
                    padding: '0', 
                    minHeight: '34px', 
                    "&.Mui-expanded": { minHeight: '34px', height: '34px' },
                    ".MuiAccordionSummary-content": { margin: 0 },
                    ".MuiAccordionSummary-expandIconWrapper": { margin: 0 }
                }} 
                expandIcon={ <ExpandMoreIcon sx={{display: showAccordion ? 'block' : 'none'}} />}>
                <Typography variant="h6" gutterBottom>
                    Leader Notes
                </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{margin: '0', padding: '0', maxHeight: '350px', overflow: showAccordion ? 'scroll' : 'visible'}}>
                {isEditing ? (
                    <ConsortiumLeaderNotesEdit
                        consortiumLeaderNotes={consortiumLeaderNotes}
                        onSave={handleSave}
                        onCancel={handleCancel}
                    />
                ) : (
                    <ConsortiumLeaderNotesDisplay consortiumLeaderNotes={consortiumLeaderNotes} />
                )}
                {/* Only show the Edit button if the user is the leader */}
                {!isEditing && isLeader && (
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={handleEdit}
                        sx={{ mt: 1 }}
                    >
                        Edit
                    </Button>
                )}
            </AccordionDetails>
            </Accordion>
        </Box>
    );
}
