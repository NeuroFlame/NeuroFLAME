import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react'
import { clearUserSession, restoreUserSession, saveUserSession, UserSession } from './userSession'

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
