import { useUserState } from '../../contexts/UserStateContext'

export interface RunMemberLike {
  id: string
  username: string
  vault?: {
    name: string
    description: string
  }
}

interface UseMembersProps {
  members: RunMemberLike[];
  activeMembers: RunMemberLike[];
  readyMembers: RunMemberLike[];
  leader: RunMemberLike;
}

export const useMembers = ({
  members,
  activeMembers,
  readyMembers,
  leader,
}: UseMembersProps) => {
  const { userId } = useUserState()

  const isActiveMember = (member: RunMemberLike) =>
    activeMembers.some((activeMember) => activeMember.id === member.id)

  const isReadyMember = (member: RunMemberLike) =>
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
