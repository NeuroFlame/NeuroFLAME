import { useState } from 'react';
import { Box, Button, CardActions, FormControlLabel, Switch, Typography } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import MemberLeaveButton from "./MemberLeaveButton";
import VaultUsersButton from "./VaultUsersButton";
import MembersListDisplay from './MembersListDisplay';
import MembersListEdit from './MembersListEdit';
import { useConsortiumDetailsContext } from "../ConsortiumDetailsContext";

interface MembersDisplayProps {
    memberList: {
        id: string;
        username: string;
        isActive: boolean;
        isReady: boolean;
        isLeader: boolean;
        isMe: boolean;
    }[];
    setMemberActive: (memberId: string, isActive: boolean) => void;
    setMemberReady: (memberId: string, isReady: boolean) => void;
    leaderSetMemberActive: ( userId: string ) => void;
    leaderSetRemoveMember: ( userId: string ) => void;
    handleLeave: () => void;
}


export function MembersDisplay({ memberList, setMemberActive, setMemberReady, handleLeave, leaderSetMemberActive, leaderSetRemoveMember }: MembersDisplayProps) {

    const itsMe = memberList.find((member) => member.isMe === true);
    const { isLeader } = useConsortiumDetailsContext();
    const [editMembers, setEditMembers] = useState<boolean>(false);

    return (<Box
        p={2}
        borderRadius={2}
        marginBottom={2}
        bgcolor={'white'}
        style={{ position: 'relative' }}
    >
        <Box>
            <Box sx={{ position: 'relative' }}>
                <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1rem 0'}}>
                    <Typography variant="h6" gutterBottom>
                        {editMembers ? 'Edit Members' : 'Members'}
                    </Typography>
                    {isLeader && <Button
                        color="primary"
                        size="medium"
                        variant="text"
                        sx={{marginRight: '-0.5rem'}} 
                        onClick={() => setEditMembers(!editMembers)}
                    >
                        {editMembers ? 'Close' : 'Edit Members'}
                        {editMembers && <CloseIcon />}
                    </Button>}
                </Box>
                {editMembers ? <MembersListEdit memberList={memberList} leaderSetMemberActive={leaderSetMemberActive} leaderSetRemoveMember={leaderSetRemoveMember} setMemberReady={setMemberReady} /> : <MembersListDisplay memberList={memberList} />}
            </Box>
            {!editMembers && <div style={{ position: "absolute", bottom: '5rem', right: '1.5rem' }}>
                <Box
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        alignItems: "flex-end",
                        paddingBottom: "0.5rem",
                        paddingRight: "0.5rem"
                    }}
                >
                    <CardActions
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "flex-end",
                            padding: 0,
                            margin: 0
                        }}
                    >
                        {/* Active/Inactive Switch */}
                        {itsMe && <FormControlLabel
                            label={"Active"}
                            labelPlacement="start"
                            sx={{ color: '#333' }}
                            control={
                                <Switch
                                    checked={itsMe.isActive}
                                    onChange={(_, checked) => setMemberActive(itsMe.id, checked)} // Corrected onChange
                                    size="small"
                                />
                            }
                        />}

                        {/* Ready/Not Ready Switch */}
                        {itsMe && itsMe.isActive && <FormControlLabel
                            label={"Ready"}
                            labelPlacement="start"
                            sx={{ color: '#333' }}
                            control={
                                <Switch
                                    color="primary"
                                    checked={itsMe?.isReady}
                                    onChange={(_, checked) => setMemberReady(itsMe.id, checked)} // Corrected onChange
                                    size="small"
                                />
                            }
                        />}
                    </CardActions>
                </Box>
            </div>}
        </Box>
        <Box sx={{
            display: 'inline-flex', 
            flexDirection: "row", 
            justifyContent: 'flex-start', 
            alignItems: 'center', 
            gap: '1rem',
            width: '100%',
            margin: '1rem 0 0'
            }}>
            {isLeader && <VaultUsersButton />}
            <MemberLeaveButton handleLeave={handleLeave} />
        </Box>
    </Box>);
}
