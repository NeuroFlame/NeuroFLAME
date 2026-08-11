import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react'
import { connectAsUser } from '../apis/edgeApi/connectAsUser'
import { disconnectAsUser } from '../apis/edgeApi/disconnectAsUser'
import { useApolloClients } from './ApolloClientsContext'

interface UserStateContextType {
  userId: string;
  username: string;
  roles: string[];
  setUserData: (userData: {
    accessToken: string,
    userId: string,
    username: string,
    roles: string[],
  }, options?: { keepLoggedIn?: boolean }) => Promise<void>;
  clearUserData: () => Promise<void>;
}

const UserStateContext =
  createContext<UserStateContextType | undefined>(undefined)

export const UserStateProvider = ({ children }: { children: ReactNode }) => {
  const { edgeClientApolloClient } = useApolloClients()
  const [userData, _setUserData] = useState({
    accessToken: '',
    userId: '',
    username: '',
    roles: [] as string[],
  })

  useEffect(() => {
    loadUserFromLocalStorage().catch(() => {
      console.warn('Unable to restore the saved local session')
    })
  }, [edgeClientApolloClient])

  const loadUserFromLocalStorage = async () => {
    const keepLoggedIn = localStorage.getItem('keepLoggedIn') === 'true'

    if (!keepLoggedIn) {
      await clearLocalStorageForUser()
      return
    }

    const localAccessToken = localStorage.getItem('accessToken')
    const localUserId = localStorage.getItem('userId')
    const localUsername = localStorage.getItem('username')
    const localRoles = localStorage.getItem('roles')

    // if all of these exist, set the user state
    if (
      localAccessToken &&
      localUserId &&
      localUsername &&
      localRoles &&
      edgeClientApolloClient
    ) {
      sessionStorage.setItem('accessToken', localAccessToken)
      try {
        const roles = JSON.parse(localRoles)
        if (!Array.isArray(roles) || roles.some((role) => typeof role !== 'string')) {
          throw new Error('Invalid stored roles')
        }
        const authenticatedUserId = await connectAsUser(edgeClientApolloClient)
        if (authenticatedUserId !== localUserId) throw new Error('Stored user does not match token')
        _setUserData({
          accessToken: localAccessToken,
          userId: localUserId,
          username: localUsername,
          roles,
        })
      } catch {
        try {
          await disconnectAsUser(edgeClientApolloClient)
        } catch {
          console.warn('Unable to confirm local edge disconnection during session restore')
        }
        await clearLocalStorageForUser()
        _setUserData({ accessToken: '', userId: '', username: '', roles: [] })
      }
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
    sessionStorage.setItem('accessToken', accessToken)
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('userId', userId)
    localStorage.setItem('username', username)
    localStorage.setItem('roles', JSON.stringify(roles))
    localStorage.setItem('keepLoggedIn', 'true')
  }

  const setSessionStorageForUser = async ({
    accessToken,
  }: {
    accessToken: string,
  }) => {
    await clearLocalStorageForUser()
    sessionStorage.setItem('accessToken', accessToken)
  }

  const clearUserData = async () => {
    _setUserData({
      accessToken: '',
      userId: '',
      username: '',
      roles: [],
    })
    await clearLocalStorageForUser()
  }

  const clearLocalStorageForUser = async () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    localStorage.removeItem('roles')
    localStorage.removeItem('keepLoggedIn')
    sessionStorage.removeItem('accessToken')
  }

  const setUserData = async (data: {
    accessToken: string,
    userId: string,
    username: string,
    roles: string[],
  }, options?: { keepLoggedIn?: boolean }) => {
    _setUserData({
      accessToken: data.accessToken,
      userId: data.userId,
      username: data.username,
      roles: data.roles,
    })

    if (options?.keepLoggedIn) {
      await setLocalStorageForUser(data)
      return
    }

    await setSessionStorageForUser(data)
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
