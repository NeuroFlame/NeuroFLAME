import { useMembers } from './useMembers' // Functional hook
import { MembersDisplay } from './MembersDisplay' // Display component
import { ConsortiumMemberLike } from '../ConsortiumDetailsContext'

interface MembersProps {
  members: ConsortiumMemberLike[];
  activeMembers: ConsortiumMemberLike[];
  readyMembers: ConsortiumMemberLike[];
  leader: ConsortiumMemberLike;
}

export function Members({
  members,
  activeMembers,
  readyMembers,
  leader,
}: MembersProps) {
  const {
    memberList,
    setMemberActive,
    setMemberReady,
    leaderSetMemberActive,
    leaderSetRemoveMember,
    handleLeave,
  } = useMembers({ members, activeMembers, readyMembers, leader })

  return (
    <MembersDisplay
      memberList={memberList}
      setMemberActive={setMemberActive}
      setMemberReady={setMemberReady}
      leaderSetMemberActive={leaderSetMemberActive}
      leaderSetRemoveMember={leaderSetRemoveMember}
      handleLeave={handleLeave}
    />
  )
}
