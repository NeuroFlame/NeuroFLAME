import MembersStatus from "../../ConsortiumDetails/Members/MembersStatus";
import { useConsortiumDetailsContext } from "../../ConsortiumDetails/ConsortiumDetailsContext";
import { Box } from "@mui/material";

export default function StepSetReady() {
    const { data: { members, activeMembers, readyMembers, leader }, status: { loading, error }, isLeader } = useConsortiumDetailsContext();
    return (
        <MembersStatus members={members} activeMembers={activeMembers} readyMembers={readyMembers} leader={leader} />
    );
}
