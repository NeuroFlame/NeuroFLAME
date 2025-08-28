import { useState } from 'react'
import { useCentralApi } from '../../../apis/centralApi/centralApi'

export function useRequestPasswordReset(callback?: () => void) {
  const { requestPasswordReset } = useCentralApi()

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleRequestPasswordReset = async (username: string) => {
    try {
      setLoading(true)
      setError(null)
      // request to the central api
      await requestPasswordReset({ username })
      if (callback) {
        callback()
      }
    } catch (err) {
      setError((err as Error).message ||
        'Requesting password reset failed, please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { handleRequestPasswordReset, loading, error }
};
