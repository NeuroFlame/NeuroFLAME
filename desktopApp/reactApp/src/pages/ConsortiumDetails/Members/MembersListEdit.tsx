import { Box, Button } from '@mui/material'
import MemberAvatar from './MemberAvatar'

interface MembersListEditProps {
  memberList: {
    id: string;
    username: string;
    isActive: boolean;
    isReady: boolean;
    isLeader: boolean;
    isMe: boolean;
    isVaultUser: boolean;
  }[];
  leaderSetMemberActive: (
    memberId: string,
    isActive: boolean,
    isVaultUser: boolean,
  ) => void;
  leaderSetRemoveMember: (memberId: string, isVaultUser: boolean) => void;
  setMemberReady: (memberId: string, isReady: boolean) => void;
}

export default function MembersListEdit({
  memberList,
  leaderSetMemberActive,
  leaderSetRemoveMember,
}: MembersListEditProps) {
  return (
    <Box sx={{ width: '100%' }}>
      {/* Display Leader */}
      {memberList.map(({
        id,
        username,
        isActive,
        isReady,
        isLeader,
        isVaultUser,
      }, index) => (
        <Box
          key={`member-${id}-${index}`}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: index % 2 === 0 ? 'white' : '#EEF2F2',
          }}
        >
          <Box sx={{ flex: '1 1 16rem', minWidth: 0 }}>
            <MemberAvatar
              key={`${id}-${index}`}
              id={id}
              username={username}
              isLeader={isLeader}
              isActive={isActive}
              isReady={isReady}
              index={index}
              direction='row'
              nameSize='1rem'
            />
          </Box>
          <Box
            sx={{
              display: 'flex',
              flex: '0 1 auto',
              flexWrap: 'wrap',
              justifyContent: {
                xs: 'flex-start',
                sm: 'flex-end',
              },
              gap: '0.5rem',
              width: {
                xs: '100%',
                sm: 'auto',
              },
            }}
          >
            {!isLeader && (
              <Button
                color='primary'
                size='small'
                variant='outlined'
                sx={{
                  color: 'grey',
                  borderColor: 'grey',
                  minWidth: '8.5rem',
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    backgroundColor: '#f0f0f0',
                  },
                }}
                onClick={() => leaderSetMemberActive(id, !isActive, isVaultUser)}
              >
                {isActive ? 'Set Inactive' : 'Set Active'}
              </Button>
            )}
            {!isLeader && (
              <Button
                color='primary'
                size='small'
                variant='contained'
                sx={{
                  backgroundColor: 'grey',
                  minWidth: '7.5rem',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => leaderSetRemoveMember(id, isVaultUser)}
              >
                Remove
              </Button>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
