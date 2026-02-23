import { Box, Typography } from '@mui/material'
import { useMembers } from './useMembers'
import MembersListDisplay from '../ConsortiumDetails/Members/MembersListDisplay'
import { PublicUser } from '../../apis/centralApi/generated/graphql'

interface MembersDisplayProps {
  members: PublicUser[];
  activeMembers: PublicUser[];
  readyMembers: PublicUser[];
  leader: PublicUser;
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
