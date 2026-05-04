import { RunFilterType } from './RunFilter'

export const RUN_FILTER_STORAGE_KEY = 'runFilter'

interface StoredRunFilter {
  starredRuns: string[];
  filter: RunFilterType;
}

type RunFilterStorage = Record<string, StoredRunFilter>

export const DEFAULT_RUN_FILTER: RunFilterType = {
  consortia: [],
  statuses: [],
  startDate: '',
  endDate: '',
  isStarredOnly: false,
}

const DEFAULT_CONFIG: StoredRunFilter = {
  starredRuns: [],
  filter: DEFAULT_RUN_FILTER,
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function sanitizeFilter(value: unknown): RunFilterType {
  if (!value || typeof value !== 'object') {
    return DEFAULT_RUN_FILTER
  }

  const candidate = value as Partial<RunFilterType>

  return {
    consortia: isStringArray(candidate.consortia) ? candidate.consortia : [],
    statuses: isStringArray(candidate.statuses) ? candidate.statuses : [],
    startDate: typeof candidate.startDate === 'string' ? candidate.startDate : '',
    endDate: typeof candidate.endDate === 'string' ? candidate.endDate : '',
    isStarredOnly:
      typeof candidate.isStarredOnly === 'boolean' ? candidate.isStarredOnly : false,
  }
}

function sanitizePreferences(value: unknown): StoredRunFilter {
  if (!value || typeof value !== 'object') {
    return DEFAULT_CONFIG
  }

  const candidate = value as Partial<StoredRunFilter>

  return {
    starredRuns: isStringArray(candidate.starredRuns) ? candidate.starredRuns : [],
    filter: sanitizeFilter(candidate.filter),
  }
}

function readStorage(): RunFilterStorage {
  try {
    const raw = localStorage.getItem(RUN_FILTER_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.entries(parsed as Record<string, unknown>).reduce<RunFilterStorage>(
      (accumulator, [userId, preferences]) => {
        accumulator[userId] = sanitizePreferences(preferences)
        return accumulator
      },
      {},
    )
  } catch {
    return {}
  }
}

function writeStorage(storage: RunFilterStorage) {
  localStorage.setItem(RUN_FILTER_STORAGE_KEY, JSON.stringify(storage))
}

export function readRunFilterFromStorage(userId: string): StoredRunFilter {
  if (!userId) {
    return DEFAULT_CONFIG
  }

  const storage = readStorage()
  return storage[userId] || DEFAULT_CONFIG
}

export function writeRunFilterToStorage(
  userId: string,
  preferences: Partial<StoredRunFilter>,
) {
  if (!userId) {
    return
  }

  const storage = readStorage()
  const current = readRunFilterFromStorage(userId)

  storage[userId] = {
    starredRuns: preferences.starredRuns || current.starredRuns,
    filter: preferences.filter || current.filter,
  }

  writeStorage(storage)
}
