import { useUserState } from '../../../contexts/UserStateContext'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ConsortiumMemberLike,
  useConsortiumDetailsContext,
} from '../ConsortiumDetailsContext'

interface UseMembersProps {
  members: ConsortiumMemberLike[];
  activeMembers: ConsortiumMemberLike[];
  readyMembers: ConsortiumMemberLike[];
  leader: ConsortiumMemberLike;
}

export const useMembers = ({
  members,
  activeMembers,
  readyMembers,
  leader,
}: UseMembersProps) => {
  const { userId } = useUserState()
  const {
    consortiumSetMemberActive,
    consortiumSetMemberReady,
    consortiumLeave,
    leaderSetHostedVaultActive,
    leaderRemoveHostedVault,
    leaderSetMemberInactive,
    leaderRemoveMember,
  } = useCentralApi()
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const { refetch } = useConsortiumDetailsContext()
  const navigate = useNavigate()

  const isActiveMember = (member: ConsortiumMemberLike) =>
    activeMembers.some((activeMember) => activeMember.id === member.id)

  const isReadyMember = (member: ConsortiumMemberLike) =>
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

  const setMemberActive = async (memberId: string, isActive: boolean) => {
    try {
      await consortiumSetMemberActive({ consortiumId, active: isActive })
      refetch()
    } catch (error) {
      console.error('Failed to update member status:', error)
    }
  }

  const setMemberReady = async (memberId: string, isReady: boolean) => {
    try {
      await consortiumSetMemberReady({ consortiumId, ready: isReady })
      refetch()
    } catch (error) {
      console.error('Failed to update member status:', error)
    }
  }

  const leaderSetMemberActive = async (
    memberId: string,
    isActive: boolean,
    isVaultUser: boolean,
  ) => {
    try {
      if (isVaultUser) {
        await leaderSetHostedVaultActive({
          consortiumId,
          vaultId: memberId,
          active: isActive,
        })
      } else {
        await leaderSetMemberInactive({ consortiumId, userId: memberId, active: isActive })
      }
      refetch()
    } catch (error) {
      console.error('Failed to update member status:', error)
    }
  }

  const leaderSetRemoveMember = async (
    memberId: string,
    isVaultUser: boolean,
  ) => {
    try {
      if (isVaultUser) {
        await leaderRemoveHostedVault({
          consortiumId,
          vaultId: memberId,
        })
      } else {
        await leaderRemoveMember({ consortiumId, userId: memberId })
      }
      refetch()
    } catch (error) {
      console.error('Failed to update member status:', error)
    }
  }

  // Handle leaving the consortium
  const handleLeave = async () => {
    try {
      await consortiumLeave({ consortiumId })
      // You can refetch or update the UI state to reflect the change
    } catch (error) {
      console.error('Failed to leave the consortium:', error)
    } finally {
      navigate('/consortium/list')
    }
  }

  return {
    memberList,
    setMemberActive,
    setMemberReady,
    handleLeave,
    leaderSetMemberActive,
    leaderSetRemoveMember,
  }
}
