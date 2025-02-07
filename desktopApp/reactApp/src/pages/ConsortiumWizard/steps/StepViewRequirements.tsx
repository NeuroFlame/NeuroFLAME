import { Box, Grid } from '@mui/material'; 
import ConsortiumLeaderNotes from "../../ConsortiumDetails/ConsortiumLeaderNotes/ConsortiumLeaderNotes";
import ComputationDisplay from "../../ConsortiumDetails/ComputationDisplay/ComputationDisplay";
import { useConsortiumDetailsContext } from "../../ConsortiumDetails/ConsortiumDetailsContext";

export default function StepViewRequirements(){
    const {data: consortiumDetails} = useConsortiumDetailsContext();
    const consortiumLeaderNotes = consortiumDetails?.studyConfiguration?.consortiumLeaderNotes;

    return (
        <>
        <Box style={{margin: '1rem 0', color: 'red'}}>
            Before you begin, please review both the Leader and Computation Notes for this Consortium and set up your data accordingly.
        </Box>
        <Box
            sx={{
                height: 'calc(100vh - 31rem)',  // Limit height to keep within view
                overflowY: 'scroll',  // Allow vertical scrolling if content exceeds
                padding: 1,
                boxSizing: 'border-box',
                border: '1px solid #eee'
            }}
        >
            <Grid container spacing={2}>
                <Grid item xs={6}>
                    {consortiumLeaderNotes && <ConsortiumLeaderNotes consortiumLeaderNotes={consortiumLeaderNotes} />}
                </Grid>
                <Grid item xs={6}>
                    {/* Wrapping ComputationDisplay with Box to control overflow */}
                    <Box sx={{
                        height: 'calc(100vh - 26rem)',  // Limit height to keep within view
                        overflowY: 'scroll',  // Allow vertical scrolling if content exceeds
                        padding: 1,
                        boxSizing: 'border-box',
                    }}>
                        <ComputationDisplay />
                    </Box>
                </Grid>
            </Grid>
        </Box>
        </>
    )
}