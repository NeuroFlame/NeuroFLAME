import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RunListItem } from '../../../apis/centralApi/generated/graphql'
import { useCentralApi } from '../../../apis/centralApi/centralApi'

function equalRuns(a: RunListItem | null, b: RunListItem | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.runId !== b.runId) return false
  if (a.status !== b.status) return false
  if (a.lastUpdated !== b.lastUpdated) return false

  // Only compare meta if present; stringify is OK because meta is small here.
  const am = (a as any).meta ?? null
  const bm = (b as any).meta ?? null
  try {
    return JSON.stringify(am) === JSON.stringify(bm)
  } catch {
    return false
  }
}

export function useLatestRun(consortiumId: string) {
  const {
    getRunList,
    subscriptions: { consortiumLatestRunChanged },
  } = useCentralApi()

  const [latestRun, setLatestRun] = useState<RunListItem | null>(null)
  const [loading, setLoading] = useState(true)         // initial only
  const [refreshing, setRefreshing] = useState(false)  // background refetches
  const navigate = useNavigate()

  // keep a ref for last value to prevent extra renders in equality checks
  const latestRef = useRef<RunListItem | null>(null)

  const applyLatest = (next: RunListItem | null) => {
    const prev = latestRef.current
    if (!equalRuns(prev, next)) {
      latestRef.current = next
      setLatestRun(next)
    }
  }

  const fetchRunList = async (opts?: { background?: boolean }) => {
    const background = !!opts?.background
    if (!background) setLoading(true)
    else setRefreshing(true)

    try {
      const runList = await getRunList({ consortiumId })
      const sortedRunList = (runList ?? []).slice().sort(
        (a, b) => Number(b.createdAt) - Number(a.createdAt),
      )
      const next = sortedRunList[0] || null
      applyLatest(next)
    } finally {
      if (!background) setLoading(false)
      setRefreshing(false)
    }
  }

  const navigateToRunDetails = () => {
    const current = latestRef.current
    if (current) {
      navigate(`/run/details/${current.runId}`)
    }
  }

  const navigateToRunResults = () => {
    const current = latestRef.current
    if (current) {
      navigate(`/run/results/${consortiumId}/${current.runId}`)
    }
  }

  // Debounce bursty subscription events a bit to avoid rapid refetch → flicker
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleBackgroundRefetch = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      fetchRunList({ background: true })
    }, 300) // 300ms debounce
  }

  useEffect(() => {
    fetchRunList()
    const sub = consortiumLatestRunChanged({ consortiumId }).subscribe({
      next: () => scheduleBackgroundRefetch(),
      error: () => scheduleBackgroundRefetch(),
    })
    return () => {
      sub.unsubscribe()
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consortiumId])

  // memoize the return to prevent unnecessary renders of consumers
  return useMemo(() => ({
    latestRun,
    loading,
    refreshing,
    navigateToRunDetails,
    navigateToRunResults,
  }), [latestRun, loading, refreshing])
}