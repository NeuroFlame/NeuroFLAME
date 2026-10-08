export interface UserSession {
  accessToken: string;
  userId: string;
  username: string;
  roles: string[];
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const USER_KEYS = ['accessToken', 'userId', 'username', 'roles'] as const

const clearUserFields = (storage: SessionStorage) => {
  for (const key of USER_KEYS) storage.removeItem(key)
}

const writeUserFields = (storage: SessionStorage, user: UserSession) => {
  storage.setItem('accessToken', user.accessToken)
  storage.setItem('userId', user.userId)
  storage.setItem('username', user.username)
  storage.setItem('roles', JSON.stringify(user.roles))
}

const readUserFields = (storage: SessionStorage): UserSession | null => {
  const accessToken = storage.getItem('accessToken')
  const userId = storage.getItem('userId')
  const username = storage.getItem('username')
  const storedRoles = storage.getItem('roles')
  if (!accessToken || !userId || !username || !storedRoles) return null

  try {
    const roles: unknown = JSON.parse(storedRoles)
    if (!Array.isArray(roles) || !roles.every((role): role is string => typeof role === 'string')) return null
    return { accessToken, userId, username, roles }
  } catch {
    // Invalid persisted data is discarded; no credentials are logged.
    return null
  }
}

export const clearUserSession = (local: SessionStorage, session: SessionStorage) => {
  clearUserFields(local)
  local.removeItem('keepLoggedIn')
  clearUserFields(session)
}

export const saveUserSession = (
  user: UserSession,
  keepLoggedIn: boolean,
  local: SessionStorage,
  session: SessionStorage,
) => {
  clearUserSession(local, session)
  // Identity and roles must survive a renderer reload alongside the token.
  writeUserFields(session, user)
  if (keepLoggedIn) {
    writeUserFields(local, user)
    local.setItem('keepLoggedIn', 'true')
  }
}

export const restoreUserSession = (local: SessionStorage, session: SessionStorage): UserSession | null => {
  const currentUser = readUserFields(session)
  if (currentUser) return currentUser

  if (local.getItem('keepLoggedIn') === 'true') {
    const rememberedUser = readUserFields(local)
    if (rememberedUser) {
      writeUserFields(session, rememberedUser)
      return rememberedUser
    }
  }

  clearUserSession(local, session)
  return null
}
