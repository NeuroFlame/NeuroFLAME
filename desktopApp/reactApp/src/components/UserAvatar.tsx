import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'

export default function UserAvatar(props: any) {
  const { username } = props

  return (
    <Tooltip title={username || ''} arrow>
      <Avatar
        sx={{
          bgcolor: '#FF007A',
          width: '32px',
          height: '32px',
          marginLeft: '1rem',
          marginRight: '0.5rem',
          fontStyle: 'none',
        }}
      >
        {username && typeof username === 'string' && username.charAt(0).toUpperCase()}
      </Avatar>
    </Tooltip>
  )
}
