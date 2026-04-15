import { useCallback, useEffect, useState } from 'react'
import { readRunFilterFromStorage, writeRunFilterToStorage } from './runFilterStorage'

export function useStarredRuns(userId: string) {
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const { starredRuns } = readRunFilterFromStorage(userId)
    setStarredIds(new Set(starredRuns))
  }, [userId])

  const toggleStar = useCallback((runId: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      writeRunFilterToStorage(userId, {
        starredRuns: Array.from(next),
      })
      return next
    })
  }, [userId])

  const isStarred = useCallback(
    (runId: string) => starredIds.has(runId),
    [starredIds],
  )

  return { starredIds, toggleStar, isStarred }
}
