import React from "react";
import { useMembers } from "./useMembers"; // Functional hook
import { MembersDisplay } from "./MembersDisplay"; // Display component
import { PublicUser } from "../../../apis/centralApi/generated/graphql";

interface MembersProps {
    members: PublicUser[];
    activeMembers: PublicUser[];
    readyMembers: PublicUser[];
    leader: PublicUser;
}

export function Members({ members, activeMembers, readyMembers, leader }: MembersProps) {
    const { memberList, setMemberActive, setMemberReady, leaderSetMemberActive, leaderSetRemoveMember, handleLeave } = useMembers({ members, activeMembers, readyMembers, leader });

    return <MembersDisplay 
            memberList={memberList} 
            setMemberActive={setMemberActive} 
            setMemberReady={setMemberReady} 
            leaderSetMemberActive={leaderSetMemberActive}
            leaderSetRemoveMember={leaderSetRemoveMember}
            handleLeave={handleLeave} 
        />;
}
