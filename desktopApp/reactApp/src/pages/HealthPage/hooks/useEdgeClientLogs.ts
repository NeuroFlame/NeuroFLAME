import { useCallback, useEffect, useRef, useState } from 'react'
import { electronApi } from '../../../apis/electronApi/electronApi'

const DEFAULT_TIMEOUT_MS = 8000

export function useEdgeClientLogs(initialLines: number = 200, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<any>()

  const getLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await electronApi.getEdgeClientLogs({ maxLines: initialLines })
      if (response?.error) throw new Error(response.error)
      setLines(response?.lines ?? [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load Edge client logs')
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [initialLines])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      getLogs()
    }, timeoutMs)

    return () => {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return {
    lines,
    loading,
    error,
    getLogs,
  }
}
