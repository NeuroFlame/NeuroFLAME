import React, { useState } from "react";
import { useCentralApi } from "../../../apis/centralApi/centralApi";
import { Button, Typography, CircularProgress } from "@mui/material";

interface MemberLeadButtonProps {
    handleLeave: () => void;
}

const MemberLeaveButton: React.FC<MemberLeadButtonProps> = ({handleLeave}) => {
    return (
        <Button
            variant="outlined"
            onClick={handleLeave}
            size='small' 
            fullWidth
        >
            Leave Consortium
        </Button>
    );
}

export default MemberLeaveButton;
