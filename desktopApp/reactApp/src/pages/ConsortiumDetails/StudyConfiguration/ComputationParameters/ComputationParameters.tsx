import React from "react";
import { HashLink } from 'react-router-hash-link';
import { Button, Box, Typography } from "@mui/material";
import ComputationParametersDisplay from "./ComputationParametersDisplay";
import ComputationParametersEdit from "./ComputationParametersEdit";
import { useComputationParameters } from "./useComputationParameters";

interface ComputationParametersProps {
    computationParameters: string;
}

const ComputationParameters: React.FC<ComputationParametersProps> = ({ computationParameters }) => {
    const { isEditing, handleEdit, handleSave, handleCancel, isLeader } = useComputationParameters(computationParameters);

    return (
        <Box p={2} borderRadius={2}  marginBottom={0} bgcolor={'white'}>
            <Typography variant="h6" gutterBottom>
                Settings <span style={{fontSize: '12px', color: 'black'}}>(parameters.json)</span>
            </Typography>
            {isEditing ? (
                <ComputationParametersEdit
                    computationParameters={computationParameters}
                    onSave={handleSave}
                    onCancel={handleCancel}
                />
            ) : (
                <ComputationParametersDisplay computationParameters={computationParameters} />
            )}
            <Box display="flex" justifyContent="space-between" alignItems="center">
            {!isEditing && isLeader &&
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleEdit}
                >
                    Edit
                </Button>
            }
            {isLeader && 
            <HashLink id="compnotes-anchor" style={{fontSize: '0.9rem', marginTop: '0.5rem'}} to="#compnotes">View Computation Notes</HashLink>
            }
            </Box>
        </Box>
    );
};

export default ComputationParameters;
