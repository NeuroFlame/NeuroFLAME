import { useCallback, useEffect, useRef, useState } from 'react'
import { electronApi } from '../../../apis/electronApi/electronApi'

const DEFAULT_TIMEOUT_MS = 8000

export function useEdgeClientLogs(initialLines: number = 200, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const getLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await electronApi.getEdgeClientLogs({ maxLines: initialLines })
      if (response?.error) throw new Error(response.error)
      setLines(response?.lines ?? [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load Edge client logs'
      setError(message)
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
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [getLogs, timeoutMs])

  return {
    lines,
    loading,
    error,
    getLogs,
  }
}
