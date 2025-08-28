import MembersStatus from '../../ConsortiumDetails/Members/MembersStatus'
import { useConsortiumDetailsContext } from '../../ConsortiumDetails/ConsortiumDetailsContext'

export default function StepSetReady() {
  const {
    data: {
      members,
      activeMembers,
      readyMembers,
      leader,
    },
  } = useConsortiumDetailsContext()
  return (
    <MembersStatus
      members={members}
      activeMembers={activeMembers}
      readyMembers={readyMembers}
      leader={leader}
    />
  )
}
