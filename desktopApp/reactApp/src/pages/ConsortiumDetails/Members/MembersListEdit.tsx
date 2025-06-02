import { Box, Button } from "@mui/material";
import MemberAvatar from "./MemberAvatar";

interface MembersListEditProps {
    memberList: {
        id: string;
        username: string;
        isActive: boolean;
        isReady: boolean;
        isLeader: boolean;
        isMe: boolean;
    }[];
    leaderSetMemberActive: (userId: string) => void;
    leaderSetRemoveMember: (userId: string) => void;
    setMemberReady: (memberId: string, isReady: boolean) => void;
}


export default function MembersListEdit({ memberList, leaderSetMemberActive, leaderSetRemoveMember }: MembersListEditProps) {
    return (
        <Box style={{width: '100%'}}>
            {/* Display Leader */}
            {memberList.map(({ id, username, isActive, isReady, isLeader }, index) => {
                return (
                    <Box 
                        key={`member-${id}-${index}`}
                        style={{
                            display: 'flex', 
                            flexDirection: 'row', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            width: 'calc(100% - 2rem)',
                            padding: '0.5rem 1rem',
                            background: index % 2 == 0 ? 'white' : '#EEF2F2'
                        }}
                    >
                        <div>
                            <MemberAvatar 
                                key={`${id}-${index}`}
                                username={username} 
                                isLeader={isLeader} 
                                isActive={isActive} 
                                isReady={isReady}
                                index={index} 
                                direction="row"
                                nameSize="1rem"
                            />
                        </div>
                        <div style={{display: 'flex', flexDirection: 'row', gap: '0.5rem'}}>
                            {isActive && <Button
                                color="primary"
                                size="small"
                                variant="outlined"
                                style={{borderColor: 'grey'}}
                                sx={{
                                    color: 'grey',
                                    borderColor: 'grey',
                                    "&:hover": {
                                      backgroundColor: "#f0f0f0", // Light gray on hover
                                    },
                                  }}
                                onClick={() => leaderSetMemberActive(id)}
                            >
                                Set Inactive
                            </Button>}
                            {!isLeader && <Button
                                color="primary"
                                size="small"
                                variant="contained"
                                style={{backgroundColor: 'grey'}}
                                onClick={() => leaderSetRemoveMember(id)}
                            >
                                Remove
                            </Button>}
                        </div>
                    </Box>
                );
            })}
        </Box>
)}
