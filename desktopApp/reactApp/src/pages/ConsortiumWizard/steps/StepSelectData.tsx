import { Box } from '@mui/material'; 
import DirectorySelect from "../../ConsortiumDetails/DirectorySelect/DirectorySelect";

export default function StepSelectData(){
    return (
    <Box style={{
        maxWidth: '400px',
        border: '1px solid #eee',
    }}>
        <DirectorySelect></DirectorySelect>
    </Box>)
}