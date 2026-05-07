const STATUS_ORDER: Record<string, number> = {
  'In Progress': 0,
  'Starting': 1,
  'Provisioning': 2,
  'Pending': 3,
  'Complete': 4,
  'Error': 5,
}

export const RUN_STATUS_OPTIONS: string[] = Object.keys(STATUS_ORDER)

export function sortRunStatuses(statuses: string[]): string[] {
  return [...statuses].sort((a, b) => {
    const aOrder = STATUS_ORDER[a] ?? 99
    const bOrder = STATUS_ORDER[b] ?? 99
    return aOrder - bOrder
  })
}
