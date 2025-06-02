import ComputationDisplay from "../../ConsortiumDetails/ComputationDisplay/ComputationDisplay";
import ComputationParameters from "../../ConsortiumDetails/ComputationParameters/ComputationParameters";
import { Grid, Box } from "@mui/material";

export default function StepSetParameters() {
    return (
        <Box
            sx={{
                height: 'calc(100vh - 28rem)',  // Limit height to keep within view
                overflowY: 'scroll',  // Allow vertical scrolling if content exceeds
                padding: 1,
                boxSizing: 'border-box',
                border: '1px solid #eee'
            }}
        >
            <Grid container spacing={2}>
                <Grid item xs={6}>
                    <ComputationParameters />
                </Grid>
                <Grid item xs={6}>
                    {/* Wrapping ComputationDisplay with Box to control overflow */}
                    <Box sx={{
                        height: 'calc(100vh - 26rem)',  // Limit height to keep within view
                        overflowY: 'scroll',  // Allow vertical scrolling if content exceeds
                        padding: 1,
                        boxSizing: 'border-box',
                    }}>
                        <ComputationDisplay notesHeading={true} />
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
