import { Box } from '@mui/material'
import MemberAvatar from './MemberAvatar'

interface MemberListItem {
  id: string;
  username: string;
  isActive: boolean;
  isReady: boolean;
  isLeader: boolean;
  isMe: boolean;
  isVaultUser: boolean;
}

interface MembersListDisplayProps {
  memberList: MemberListItem[];
}

const getMemberSortRank = (member: MemberListItem): number => {
  if (member.isLeader) return 0
  if (member.isReady && member.isActive) return 1
  if (!member.isActive && member.isReady) return 2
  if (member.isActive && !member.isReady) return 3
  return 4
}

export default function MembersListDisplay({
  memberList,
}: MembersListDisplayProps) {
  const sortedMembers = [...memberList].sort((a, b) => {
    const rankDifference = getMemberSortRank(a) - getMemberSortRank(b)

    if (rankDifference !== 0) {
      return rankDifference
    }

    return a.username.localeCompare(b.username)
  })

  return (
    <Box
      sx={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        justifyItems: 'center',
        width: '100%',
      }}
    >
      {sortedMembers.map(({
        id,
        username,
        isActive,
        isReady,
        isLeader,
        isVaultUser,
      }, index) => (
        <Box
          key={`${id}-${index}`}
          sx={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'center',
            minWidth: 0,
            width: '100%',
          }}
        >
          <MemberAvatar
            id={id}
            username={username}
            isLeader={isLeader}
            isActive={isActive}
            isReady={isReady}
            isVaultUser={isVaultUser}
            index={index}
            direction="column"
          />
        </Box>
      ))}
    </Box>
  )
}
