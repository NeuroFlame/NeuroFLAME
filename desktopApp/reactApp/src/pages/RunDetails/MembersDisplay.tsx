import { Box, Typography } from '@mui/material'
import { RunMemberLike, useMembers } from './useMembers'
import MembersListDisplay from '../ConsortiumDetails/Members/MembersListDisplay'

interface MembersDisplayProps {
  members: RunMemberLike[];
  activeMembers: RunMemberLike[];
  readyMembers: RunMemberLike[];
  leader: RunMemberLike;
}

export function MembersDisplay({
  members,
  activeMembers,
  readyMembers,
  leader,
}: MembersDisplayProps) {
  const {
    memberList,
  } = useMembers({ members, activeMembers, readyMembers, leader })

  return (
    <Box
      p={2}
      borderRadius={2}
      bgcolor='white'
    >
      <Box>
        <Typography variant='h6' gutterBottom>
          Members
        </Typography>
        <Box>
          <MembersListDisplay memberList={memberList} />
        </Box>
      </Box>
    </Box>
  )
}
