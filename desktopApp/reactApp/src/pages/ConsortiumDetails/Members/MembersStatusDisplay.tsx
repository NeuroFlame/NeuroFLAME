import { Box, Button } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface MembersStatusDisplayProps {
    memberList: {
        id: string;
        username: string;
        isActive: boolean;
        isReady: boolean;
        isLeader: boolean;
        isMe: boolean;
    }[];
    setMemberReady: (memberId: string, isReady: boolean) => void;
}


export function MembersStatusDisplay({ memberList, setMemberReady }: MembersStatusDisplayProps) {

    const itsMe = memberList.find((member) => member.isMe === true);

    return(
     <>
        {/* Ready/Not Ready Switch */}
        {itsMe && 
            <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                <Button
                    color="success"
                    onClick={() => setMemberReady(itsMe.id, true)}
                    size="medium"
                    variant="contained" 
                    disabled={itsMe.isReady}
                >
                    {itsMe.isReady ? "You\'re Ready!" : 'Set Yourself as "Ready"'}
                </Button>
                {itsMe.isReady && <CheckCircleIcon 
                    sx={{ 
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        color: '#2FA84F', 
                        width: '32px', 
                        height: '32px', 
                        top: '-2px',
                    }}
                />}
            </Box>
        }
    </>);
}
                