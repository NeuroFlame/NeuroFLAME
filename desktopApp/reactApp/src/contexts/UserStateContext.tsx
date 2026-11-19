import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react'
import {
  accessTokenExpiresAt,
  clearUserSession,
  restoreUserSession,
  saveUserSession,
  UserSession,
} from './userSession'

// setTimeout cannot wait longer than this.
const MAX_TIMER_MS = 2 ** 31 - 1

interface UserStateContextType {
  userId: string;
  username: string;
  roles: string[];
  isInitialized: boolean;
  setUserData: (userData: UserSession, options?: { keepLoggedIn?: boolean }) => void;
  clearUserData: () => void;
}

const UserStateContext =
  createContext<UserStateContextType | undefined>(undefined)

export const UserStateProvider = ({ children }: { children: ReactNode }) => {
  const [userData, _setUserData] = useState({
    accessToken: '',
    userId: '',
    username: '',
    roles: [] as string[],
  })
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const user = restoreUserSession(localStorage, sessionStorage)
    if (user) _setUserData(user)
    setIsInitialized(true)
  }, [])

  const clearUserData = () => {
    _setUserData({
      accessToken: '',
      userId: '',
      username: '',
      roles: [],
    })
    clearUserSession(localStorage, sessionStorage)
  }
  const setUserData = (data: UserSession, options?: { keepLoggedIn?: boolean }) => {
    saveUserSession(data, options?.keepLoggedIn ?? false, localStorage, sessionStorage)
    _setUserData(data)
  }

  // Sign out when the session token expires, so the user is sent back to the
  // login page instead of every request failing.
  useEffect(() => {
    const expiresAt = accessTokenExpiresAt(userData.accessToken)
    if (expiresAt === null) return
    const timer = setTimeout(clearUserData, Math.min(Math.max(expiresAt - Date.now(), 0), MAX_TIMER_MS))
    return () => clearTimeout(timer)
  }, [userData.accessToken])

  return (
    <UserStateContext.Provider
      value={{
        userId: userData.userId,
        username: userData.username,
        roles: userData.roles,
        isInitialized,
        setUserData,
        clearUserData,
      }}
    >
      {children}
    </UserStateContext.Provider>
  )
}

export const useUserState = (): UserStateContextType => {
  const context = useContext(UserStateContext)
  if (context === undefined) {
    throw new Error('useUserState must be used within a UserStateProvider')
  }
  return context
}
