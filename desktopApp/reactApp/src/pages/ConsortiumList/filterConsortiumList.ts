import type { ConsortiumListItem } from '../../apis/centralApi/generated/graphql'
import type { ConsortiumFilterType } from './ConsortiumFilter'

export const filterConsortiumList = (
  consortiumList: ConsortiumListItem[],
  filter: ConsortiumFilterType,
  userId: string,
): ConsortiumListItem[] => {
  const searchTerm = filter.name.trim().toLowerCase()
  const isMember = (consortium: ConsortiumListItem) =>
    Boolean(userId) && consortium.members.some((member) => member.id === userId)

  // Filter creates a new array so sorting never mutates the fetched list.
  return consortiumList
    .filter(({ title }) => (title || '').toLowerCase().includes(searchTerm))
    .sort((a, b) => {
      // Membership takes priority over either date sort direction.
      const membershipDiff = Number(isMember(b)) - Number(isMember(a))
      if (membershipDiff !== 0) return membershipDiff

      const dateDiff = +b.createdAt - +a.createdAt
      return filter.sortOrder === 'newest' ? dateDiff : -dateDiff
    })
}
