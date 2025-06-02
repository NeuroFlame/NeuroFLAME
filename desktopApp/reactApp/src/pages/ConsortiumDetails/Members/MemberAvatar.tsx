import { styled } from '@mui/material/styles';
import { Avatar, Box } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Shield from '../../../assets/shield.svg';
import GreyShield from '../../../assets/grey_shield.svg';
import Crown from '../../../assets/crown.svg';

const UserColor: string[] = [
  "#2FA84F", //green
  "#FFBA08", //yellow
  "#FF007A", //magenta
  "#F25919", //orange
  "#B91372", //violet
  "#440381", //purple
  "#016572", //heather
];

const GetUserColor = (index: number, active: boolean): string => {
  if (active) {
    const valkeyIndex = index % UserColor.length; 
    return UserColor[valkeyIndex];
  } else {
    return "#ddd";
  }
};

const UserAvatar = styled(Avatar, {
  shouldForwardProp: (prop) => prop !== 'admin' && prop !== 'active'
})<{ index: number; admin: boolean; active: boolean }>(({ index, admin, active }) => ({
  width: '45px',
  height: '45px',
  background: !admin ? GetUserColor(index, active) : 'none'
}));

interface MemberAvatarProps {
  username: string;
  isLeader: boolean;
  isActive: boolean;
  isReady: boolean;
  index: number;
  direction?: string|null;
  nameSize?: string
}

const MemberAvatar: React.FC<MemberAvatarProps> = (props) => {   

  const { username, isLeader, isActive, isReady, index, direction, nameSize } = props;

  return (
    <Box 
      style={{
        position: "relative",
        display: "inline-flex",
        marginRight: "0.5rem",
        marginBottom: "0.5rem",
        textAlign: "center",
        flexDirection: (direction as React.CSSProperties["flexDirection"]) || "column",
        justifyContent: "space-evenly",
        alignItems: "center",
        animation: "fadeIn 2s",
      }}>
      <Box style={{position: 'relative'}}>
      {isReady ? 
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
        /> : ''}
        {isLeader && 
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
            rotate: '-25deg'
          }} 
        />
        }
      <UserAvatar index={index} admin={isLeader} active={isActive}>
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
        {isLeader &&  
          <img 
            src={isActive ? Shield : GreyShield}
            style={{ 
              position: 'absolute',
              width: '50px', 
              height: '50px', 
              zIndex: '1',
              objectFit: 'cover',
            }} 
          />}  
      </UserAvatar>
      </Box>
      <span
        className="username"
        style={{
          color: isActive ? '#000' : '#aaa',
          marginLeft: direction === 'row' ? '0.5rem' : '0',
          fontSize: nameSize
        }}
      >
        {username}
      </span>
    </Box>
  );
}

export default MemberAvatar;
