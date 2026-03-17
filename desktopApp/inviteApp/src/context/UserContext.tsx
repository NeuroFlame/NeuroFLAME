import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useApolloClient } from '@apollo/client/react'
import { tokenStorage } from '../auth/token'
import type { UserProfile } from '../graphql/types'
import { GET_USER_PROFILE } from '../graphql/queries'
import { Box, CircularProgress } from '@mui/material'

type UserContextType = {
  user: UserProfile | null
  loading: boolean
  isAuthenticated: boolean
  setUser: (user: UserProfile | null) => void
  fetchCurrentUser: () => Promise<void>
  logout: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

type Props = {
  children: ReactNode
}

export function UserProvider({ children }: Props) {
  const client = useApolloClient()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchCurrentUser = useCallback(async () => {
    const token = tokenStorage.get()

    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const { data } = await client.query<{ getUserProfile: UserProfile }>({
        query: GET_USER_PROFILE,
        fetchPolicy: 'network-only',
      })

      setUser(data?.getUserProfile || null)
    } catch {
      tokenStorage.clear()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [client])

  const logout = useCallback(async () => {
    tokenStorage.clear()
    setUser(null)
    await client.clearStore()
  }, [client])

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      setUser,
      fetchCurrentUser,
      logout,
    }),
    [user, loading, fetchCurrentUser, logout],
  )

  return (
    <UserContext.Provider value={value}>
      {loading ? (
        <Box
          display='flex'
          justifyContent='center'
          alignItems='center'
          sx={{
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            padding: '2rem 1rem',
            overflow: 'hidden',
          }}
        >
          <CircularProgress size='3rem' />
        </Box>
      ) : children}
    </UserContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUser() {
  const context = useContext(UserContext)

  if (!context) {
    throw new Error('useUser must be used inside UserProvider')
  }

  return context
}
