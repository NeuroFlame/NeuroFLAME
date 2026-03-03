import { useState } from 'react'
import { useCentralApi } from '../../../apis/centralApi/centralApi'

export function useCreateUser() {
  const { userCreate } = useCentralApi()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleUserCreate = async (username: string, email: string, password: string) => {
    try {
      setLoading(true)
      setError(null)
      // request to the central api
      await userCreate({ username, email, password })
      setSuccess(true)
    } catch (err) {
      setError('Create user failed, please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { handleUserCreate, loading, error, success }
};
