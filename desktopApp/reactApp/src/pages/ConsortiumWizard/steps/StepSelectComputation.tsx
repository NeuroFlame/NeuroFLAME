import { Box } from '@mui/material'; 
import Computation from "../../ConsortiumDetails/Computation/Computation";
import { useConsortiumDetailsContext } from "../../ConsortiumDetails/ConsortiumDetailsContext";

export default function StepSelectComputation() {
    const {data: consortiumDetails} = useConsortiumDetailsContext();
    const selectedComputation = consortiumDetails?.studyConfiguration?.computation;

    return  (   
    <Box style={{maxWidth: '400px', border: '1px solid #eee', marginBottom: '1rem' }}>
        <Computation computation={selectedComputation}></Computation>
    </Box>
    )
}