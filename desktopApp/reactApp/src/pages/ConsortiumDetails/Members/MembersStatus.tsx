import { useMembers } from './useMembers' // Functional hook
import { MembersStatusDisplay } from './MembersStatusDisplay' // Display component
import { ConsortiumMemberLike } from '../ConsortiumDetailsContext'

interface MembersProps {
  members: ConsortiumMemberLike[];
  activeMembers: ConsortiumMemberLike[];
  readyMembers: ConsortiumMemberLike[];
  leader: ConsortiumMemberLike;
}

export default function Members({
  members,
  activeMembers,
  readyMembers,
  leader,
}: MembersProps) {
  const { memberList, setMemberReady } = useMembers({
    members,
    activeMembers,
    readyMembers,
    leader,
  })

  return (
    <MembersStatusDisplay
      memberList={memberList}
      setMemberReady={setMemberReady}
    />
  )
}
