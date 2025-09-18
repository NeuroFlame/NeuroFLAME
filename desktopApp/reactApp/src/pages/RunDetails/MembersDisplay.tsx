import { Box, Typography } from '@mui/material'
import MemberAvatar from './MemberAvatar'

interface Member {
  id: string; // or number, depending on your data
  username: string;
}

interface MembersDisplayProps {
  members: Member[];
}

export function MembersDisplay({ members }: MembersDisplayProps) {
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
          {/* Display Members */}
          {members.map(({ id, username }, index) => (
            <MemberAvatar
              key={`${id}-${index}`}
              id={id}
              username={username}
              index={index}
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}
