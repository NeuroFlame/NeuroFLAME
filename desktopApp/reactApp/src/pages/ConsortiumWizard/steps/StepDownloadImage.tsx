import { Box } from '@mui/material'; 
import Computation from "../../ConsortiumDetails/Computation/Computation";
import { useConsortiumDetailsContext } from "../../ConsortiumDetails/ConsortiumDetailsContext";
import ArrowDown from "../../../assets/arrow-down.png";

export default function StepDownloadImage() {
    const {data: consortiumDetails} = useConsortiumDetailsContext();
    const selectedComputation = consortiumDetails?.studyConfiguration?.computation;

    return  (  
    <Box style={{display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'top'}}>
        <Box style={{maxWidth: '400px', border: '1px solid #eee', marginBottom: '1rem' }}>
            <Computation computation={selectedComputation}></Computation>
        </Box>
        <Box style={{maxWidth: '400px', marginBottom: '1rem', padding: '1rem', display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'center' }}>
            <div style={{position: 'relative', width: '225px', height: '100px'}}>
                <img src={ArrowDown} style={{width: '100px', rotate: '20deg', position: 'absolute', top: '0', left: '-1rem'}} />
            </div>
            <div style={{fontWeight: 'bold'}}>
                <h3 style={{color: 'red'}}>To download the Computation Image:</h3>
                <ol>
                    <li>
                        Press this icon to copy the "Image Download" command. 
                    </li>
                    <li>
                        Open your system's terminal, paste command in and press enter. 
                    </li>
               </ol>
            </div>
        </Box>
    </Box>
    )
}