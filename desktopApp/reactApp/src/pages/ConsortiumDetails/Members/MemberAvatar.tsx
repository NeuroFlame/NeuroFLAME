import { styled } from '@mui/material/styles'
import { Avatar, Box } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Shield from '../../../assets/shield.svg'
import GreyShield from '../../../assets/grey_shield.svg'
import Crown from '../../../assets/crown.svg'
import Lock from '../../../assets/lock.svg'

const UserColor: string[] = [
  '#2FA84F', // green
  '#FFBA08', // yellow
  '#FF007A', // magenta
  '#F25919', // orange
  '#B91372', // violet
  '#440381', // purple
  '#016572', // heather
]

const hashString = (value: string): number => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

const GetUserColor = (userId: string, active: boolean): string => {
  if (!active) {
    return '#ddd'
  }

  return UserColor[hashString(userId) % UserColor.length]
}

const UserAvatar = styled(Avatar, {
  shouldForwardProp: (prop) => prop !== 'admin' && prop !== 'active' && prop !== 'userId',
})<{ userId: string; admin: boolean; active: boolean }>(({
  userId,
  admin,
  active,
}) => ({
  width: '45px',
  height: '45px',
  background: !admin ? GetUserColor(userId, active) : 'none',
}))

interface MemberAvatarProps {
  id: string;
  username: string;
  isLeader: boolean;
  isActive: boolean;
  isReady: boolean;
  isVaultUser?: boolean;
  index: number;
  direction?: string | null;
  nameSize?: string
}

const MemberAvatar: React.FC<MemberAvatarProps> = (props) => {
  const {
    id,
    username,
    isLeader,
    isActive,
    isReady,
    isVaultUser,
    index,
    direction,
    nameSize,
  } = props

  return (
    <Box
      style={{
        position: 'relative',
        display: 'inline-flex',
        marginRight: '0.5rem',
        marginBottom: '0.5rem',
        textAlign: 'center',
        flexDirection: (direction as React.CSSProperties['flexDirection']) || 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        animation: 'fadeIn 2s',
      }}
    >
      <Box style={{ position: 'relative' }}>
        {isReady ? (
          <CheckCircleIcon
            sx={{
              position: 'absolute',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              color: '#2FA84F',
              width: '16px',
              height: '16px',
              top: '-2px',
              right: '-0.25rem',
              zIndex: '3',
            }}
          />) : ''}
        {isLeader && (
          <img
            src={Crown}
            style={{
              position: 'absolute',
              borderRadius: '16px',
              color: '#2FA84F',
              width: '20px',
              height: '20px',
              top: '-10px',
              left: '0px',
              zIndex: '3',
              rotate: '-25deg',
            }}
          />
        )}
        {isVaultUser && (
          <img
            src={Lock}
            style={{
              position: 'absolute',
              borderRadius: '6px',
              width: '13px',
              height: '16px',
              top: '-3px',
              left: '-2px',
              zIndex: '3',
              padding: 0,
            }}
          />
        )}
        <UserAvatar userId={id} admin={isLeader} active={isActive}>
          <span
            style={{
              position: 'absolute',
              width: '45px',
              height: '45px',
              zIndex: '2',
              top: '33%',
            }}
          >
            {username.charAt(0).toUpperCase()}
          </span>
          {isLeader && (
            <img
              src={isActive ? Shield : GreyShield}
              style={{
                position: 'absolute',
                width: '50px',
                height: '50px',
                zIndex: '1',
                objectFit: 'cover',
              }}
            />
          )}
        </UserAvatar>
      </Box>
      <span
        className='username'
        style={{
          color: isActive ? '#000' : '#aaa',
          marginLeft: direction === 'row' ? '0.5rem' : '0',
          fontSize: nameSize,
        }}
      >
        {username}
      </span>
    </Box>
  )
}

export default MemberAvatar
