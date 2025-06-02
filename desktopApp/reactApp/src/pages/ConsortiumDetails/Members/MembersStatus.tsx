import React from "react";
import { useMembers } from "./useMembers"; // Functional hook
import { MembersStatusDisplay } from "./MembersStatusDisplay"; // Display component
import { PublicUser } from "../../../apis/centralApi/generated/graphql";

interface MembersProps {
    members: PublicUser[];
    activeMembers: PublicUser[];
    readyMembers: PublicUser[];
    leader: PublicUser;
}

export default function Members({ members, activeMembers, readyMembers, leader }: MembersProps) {
    const { memberList, setMemberReady } = useMembers({ members, activeMembers, readyMembers, leader });

    return <MembersStatusDisplay memberList={memberList} setMemberReady={setMemberReady} />;
}
