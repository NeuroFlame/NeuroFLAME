import { Box } from "@mui/material";
import MemberAvatar from "./MemberAvatar";

interface MembersListDisplayProps {
    memberList: {
        id: string;
        username: string;
        isActive: boolean;
        isReady: boolean;
        isLeader: boolean;
        isMe: boolean;
    }[];
}


export default function MembersListDisplay({ memberList }: MembersListDisplayProps) {
    return (
        <Box style={{width: 'calc(100% - 70px)'}}>
            {/* Display Leader */}
            {memberList.map(({ id, username, isActive, isReady, isLeader }, index) => {
            if (isLeader) {
                return (
                    <MemberAvatar 
                        key={`${id}-${index}`}
                        username={username} 
                        isLeader={isLeader} 
                        isActive={isActive} 
                        isReady={isReady}
                        index={index} 
                        direction="column"
                    />
                );
            }
                return null; // To handle the case where isReady is false
            })}
            {/* Display All Active And Ready Members */}
            {memberList.map(({ id, username, isActive, isReady, isLeader }, index) => {
                if (isReady && isActive && !isLeader) {
                    return (
                        <MemberAvatar 
                            key={`${id}-${index}`}
                            username={username} 
                            isLeader={isLeader} 
                            isActive={isActive} 
                            isReady={isReady}
                            index={index} 
                            direction="column"
                        />
                    );
                }
                return null; // To handle the case where isActive and isReady is false
            })}
            {/* Display Ready Members */}
            {memberList.map(({ id, username, isActive, isReady, isLeader }, index) => {
                if (!isActive && isReady && !isLeader) {
                    return (
                        <MemberAvatar 
                            key={`${id}-${index}`}
                            username={username} 
                            isLeader={isLeader} 
                            isActive={isActive} 
                            isReady={isReady}
                            index={index} 
                            direction="column"
                        />
                    );
                }
                return null; // To handle the case where isReady is true and isActive is false
            })}
            {/* Display Active Members */}
            {memberList.map(({ id, username, isActive, isReady, isLeader }, index) => {
                if (isActive && !isReady && !isLeader) {
                    return (
                        <MemberAvatar 
                            key={`${id}-${index}`}
                            username={username} 
                            isLeader={isLeader} 
                            isActive={isActive} 
                            isReady={isReady}
                            index={index} 
                            direction="column"
                        />
                    );
                }
                return null; // To handle the case where isActive is true and isReady is false
            })}
            {/* Display Joined Members */}
            {memberList.map(({ id, username, isActive, isReady, isLeader }, index) => {
                if (!isActive && !isReady && !isLeader) {
                    return (
                        <MemberAvatar 
                            key={`${id}-${index}`}
                            username={username} 
                            isLeader={isLeader} 
                            isActive={isActive} 
                            isReady={isReady}
                            index={index} 
                            direction="column"
                        />
                    );
                }
                return null; // To handle the case where isReady is false
            })}
        </Box>
)}
