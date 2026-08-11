import { useUserState } from '../../contexts/UserStateContext'
import { useEdgeApi } from '../../apis/edgeApi/edgeApi'

export function useLoginPage() {
  const { username, clearUserData } = useUserState()
  const { disconnectAsUser } = useEdgeApi()

  const logout = async () => {
    try {
      await disconnectAsUser()
    } finally {
      clearUserData()
    }
  }

  return {
    isLoggedIn: !!username,
    logout,
  }
}
