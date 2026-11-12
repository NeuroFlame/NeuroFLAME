import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { useUserState } from '../../../contexts/UserStateContext'

export function useChangePassword() {
  const { userChangePassword } = useCentralApi()
  const { clearUserData } = useUserState()
  const navigate = useNavigate()
  const pending = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChangePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (pending.current) return false
    if (!currentPassword || !newPassword) {
      setError('Enter your current password and a new password.')
      return false
    }
    pending.current = true
    setLoading(true)
    setError(null)
    try {
      await userChangePassword({ currentPassword, password: newPassword })
      clearUserData()
      navigate('/', { replace: true, state: { passwordChanged: true } })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Changing password failed. Please try again.')
      return false
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  return { handleChangePassword, loading, error }
}
