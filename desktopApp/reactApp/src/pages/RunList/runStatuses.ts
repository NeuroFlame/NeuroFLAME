export const RUN_STATUS_OPTIONS = [
  'Pending',
  'Provisioning',
  'Starting',
  'In Progress',
  'Complete',
  'Error',
] as const

const RUN_STATUS_ORDER = new Map<string, number>(
  RUN_STATUS_OPTIONS.map((status, index) => [status, index]),
)

export function sortRunStatuses(statuses: string[]): string[] {
  return [...statuses].sort((left, right) => {
    const leftOrder = RUN_STATUS_ORDER.get(left)
    const rightOrder = RUN_STATUS_ORDER.get(right)

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder
    }

    if (leftOrder !== undefined) {
      return -1
    }

    if (rightOrder !== undefined) {
      return 1
    }

    return left.localeCompare(right)
  })
}
