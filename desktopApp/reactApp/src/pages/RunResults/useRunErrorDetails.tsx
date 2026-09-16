import { useCallback, useEffect, useRef, useState } from 'react'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { RunDetails } from '../../apis/centralApi/generated/graphql'

const SHARED_RUN_ERRORS_UNAVAILABLE = 'Unable to load consortium run errors.'

export function useRunErrorDetails(runId?: string) {
  const {
    getRunDetails,
    subscriptions: { runDetailsChanged },
  } = useCentralApi()
  const [runDetails, setRunDetails] = useState<RunDetails | null>(null)
  const [loading, setLoading] = useState(Boolean(runId))
  const [error, setError] = useState<string | null>(null)
  const requestVersion = useRef(0)

  const fetchRunDetails = useCallback(async () => {
    if (!runId) {
      requestVersion.current += 1
      setRunDetails(null)
      setLoading(false)
      setError(null)
      return
    }

    const request = ++requestVersion.current
    setLoading(true)
    setError(null)

    try {
      const details = await getRunDetails({ runId })
      if (request === requestVersion.current) {
        setRunDetails(details)
      }
    } catch (fetchError) {
      console.warn('Failed to fetch consortium run errors', fetchError)
      if (request === requestVersion.current) {
        setError(SHARED_RUN_ERRORS_UNAVAILABLE)
      }
    } finally {
      if (request === requestVersion.current) {
        setLoading(false)
      }
    }
  }, [getRunDetails, runId])

  useEffect(() => {
    if (!runId) {
      fetchRunDetails()
      return
    }

    setRunDetails(null)
    fetchRunDetails()

    const subscription = runDetailsChanged({ runId }).subscribe({
      next: () => {
        fetchRunDetails()
      },
      error: (subscriptionError: unknown) => {
        console.warn('Failed to subscribe to consortium run errors', subscriptionError)
        setError(SHARED_RUN_ERRORS_UNAVAILABLE)
      },
    })

    return () => {
      requestVersion.current += 1
      subscription.unsubscribe()
    }
  }, [fetchRunDetails, runDetailsChanged, runId])

  return {
    runDetails,
    loading,
    error,
  }
}
