import { PublicUser } from '../../apis/centralApi/generated/graphql'
import { useUserState } from '../../contexts/UserStateContext'

interface UseMembersProps {
  members: PublicUser[];
  activeMembers: PublicUser[];
  readyMembers: PublicUser[];
  leader: PublicUser;
}

export const useMembers = ({
  members,
  activeMembers,
  readyMembers,
  leader,
}: UseMembersProps) => {
  const { userId } = useUserState()

  const isActiveMember = (member: PublicUser) =>
    activeMembers.some((activeMember) => activeMember.id === member.id)

  const isReadyMember = (member: PublicUser) =>
    readyMembers.some((readyMember) => readyMember.id === member.id)

  const memberList = members
    .map((member) => ({
      ...member,
      isLeader: member.id === leader.id,
      isActive: isActiveMember(member),
      isReady: isReadyMember(member),
      isMe: member.id === userId,
      isVaultUser: !!member.vault,
    }))
    .sort((a, b) => {
      if (a.isLeader) return -1
      if (b.isLeader) return 1
      if (a.isActive && !b.isActive) return -1
      if (!a.isActive && b.isActive) return 1
      return a.username.localeCompare(b.username)
    })
  return { memberList }
}
