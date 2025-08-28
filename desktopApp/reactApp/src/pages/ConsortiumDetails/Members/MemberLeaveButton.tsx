import React from 'react'
import { Button } from '@mui/material'

interface MemberLeadButtonProps {
  handleLeave: () => void;
}

const MemberLeaveButton: React.FC<MemberLeadButtonProps> = ({
  handleLeave,
}) => (
  <Button
    variant='outlined'
    onClick={handleLeave}
    size='small'
    fullWidth
  >
    Leave Consortium
  </Button>
)

export default MemberLeaveButton
