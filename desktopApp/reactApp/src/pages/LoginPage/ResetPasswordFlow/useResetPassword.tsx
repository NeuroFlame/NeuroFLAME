import { useState } from 'react'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { useNavigate } from 'react-router-dom'
import { useEdgeApi } from '../../../apis/edgeApi/edgeApi'
import { useUserState } from '../../../contexts/UserStateContext'

export function useResetPassword() {
  const { resetPassword } = useCentralApi()
  const { connectAsUser } = useEdgeApi()
  const { setUserData } = useUserState()
  const navigate = useNavigate()

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleResetPassword = async (newPassword: string, token: string) => {
    try {
      setLoading(true)
      setError(null)
      // request to the central api
      const userData = await resetPassword({ newPassword, token })
      await setUserData(userData)
      await connectAsUser()
      navigate('/home')
    } catch (err) {
      setError((err as Error).message ||
        'Resetting password failed, please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { handleResetPassword, loading, error }
};
