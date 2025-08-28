import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react'

interface UserStateContextType {
  userId: string;
  username: string;
  roles: string[];
  setUserData: (userData: {
    accessToken: string,
    userId: string,
    username: string,
    roles: string[],
  }) => void;
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

  useEffect(() => {
    loadUserFromLocalStorage()
  }, [])

  const loadUserFromLocalStorage = async () => {
    const localAccessToken = localStorage.getItem('accessToken')
    const localUserId = localStorage.getItem('userId')
    const localUsername = localStorage.getItem('username')
    const localRoles = localStorage.getItem('roles')

    // if all of these exist, set the user state
    if (localAccessToken && localUserId && localUsername && localRoles) {
      _setUserData({
        accessToken: localAccessToken,
        userId: localUserId,
        username: localUsername,
        roles: JSON.parse(localRoles),
      })
      // TODO investigate ways that don't rely on local storage
      localStorage.setItem('accessToken', localAccessToken)
    }
  }

  const setLocalStorageForUser = async ({
    accessToken,
    userId,
    username,
    roles,
  }: {
    accessToken: string,
    userId: string,
    username: string,
    roles: string[],
  }) => {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('userId', userId)
    localStorage.setItem('username', username)
    localStorage.setItem('roles', JSON.stringify(roles))
  }

  const clearUserData = async () => {
    _setUserData({
      accessToken: '',
      userId: '',
      username: '',
      roles: [],
    })
    clearLocalStorageForUser()
  }

  const clearLocalStorageForUser = async () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    localStorage.removeItem('roles')
  }

  const setUserData = async (data: {
    accessToken: string,
    userId: string,
    username: string,
    roles: string[],
  }) => {
    _setUserData({
      accessToken: data.accessToken,
      userId: data.userId,
      username: data.username,
      roles: data.roles,
    })

    setLocalStorageForUser(data)
  }

  return (
    <UserStateContext.Provider
      value={{
        userId: userData.userId,
        username: userData.username,
        roles: userData.roles,
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
