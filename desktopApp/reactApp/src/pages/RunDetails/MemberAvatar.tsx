import React, { useState } from 'react'
import { styled } from '@mui/material/styles'
import { Avatar, Box, Tooltip } from '@mui/material'

const UserColor: string[] = [
  '#FFBA08', // yellow
  '#F25919', // orange
  '#FF007A', // magenta
  '#B91372', // violet
  '#440381', // purple
  '#0066FF', // blue
  '#016572', // heather
  '#2FA84F', // green
]

const GetUserColor = (index: number): string => {
  const valkeyIndex = index % UserColor.length
  return UserColor[valkeyIndex]
}

const UserAvatar = styled(Avatar)<{ index: number }>(({ index }) => ({
  width: '45px',
  height: '45px',
  background: GetUserColor(index),
}))

interface MemberAvatarProps {
  id: string;
  username: string;
  index: number;
}

const MemberAvatar: React.FC<MemberAvatarProps> = (props) => {
  const { id, username, index } = props

  const [showId, setShowId] = useState(false)

  return (
    <Box
      style={{
        position: 'relative',
        display: 'inline-flex',
        marginRight: '0.5rem',
        marginBottom: '0.5rem',
        textAlign: 'center',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        animation: 'fadeIn 2s',
      }}
    >
      <Tooltip title={showId ? 'Click to hide User ID' : 'Click to reveal User ID'}>
        <UserAvatar index={index} onClick={() => setShowId(!showId)} style={{ cursor: 'pointer' }}>
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
        </UserAvatar>
      </Tooltip>
      <span className='username' style={{ color: '#000' }}>{username}</span>
      {showId &&
        <span
          className='username'
          style={{
            color: '#000',
            padding: '0.25rem 0.5rem',
            background: '#EEF2F2',
            borderRadius: '0.25rem',
          }}
        >
          {id}
        </span>}
    </Box>
  )
}

export default MemberAvatar
