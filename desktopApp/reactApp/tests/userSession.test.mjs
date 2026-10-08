import assert from 'node:assert/strict'
import test from 'node:test'
import { clearUserSession, restoreUserSession, saveUserSession } from '../src/contexts/userSession.ts'

const memoryStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}
const user = { accessToken: 'synthetic-token', userId: 'synthetic-user', username: 'researcher', roles: ['admin'] }

test('session login retains identity, roles and token through repeated renderer reloads', () => {
  const local = memoryStorage()
  const session = memoryStorage()
  saveUserSession(user, false, local, session)
  for (let reload = 0; reload < 3; reload++) assert.deepEqual(restoreUserSession(local, session), user)
  assert.equal(local.getItem('accessToken'), null)
  assert.equal(local.getItem('username'), null)
  assert.equal(local.getItem('keepLoggedIn'), null)
})

test('session login does not persist into a new window session', () => {
  const local = memoryStorage()
  saveUserSession(user, false, local, memoryStorage())
  assert.equal(restoreUserSession(local, memoryStorage()), null)
})

test('remembered login restores into a new session and copies the complete identity', () => {
  const local = memoryStorage()
  saveUserSession(user, true, local, memoryStorage())
  const newSession = memoryStorage()
  assert.deepEqual(restoreUserSession(local, newSession), user)
  assert.equal(newSession.getItem('username'), user.username)
  assert.equal(newSession.getItem('roles'), JSON.stringify(user.roles))
  assert.deepEqual(restoreUserSession(local, newSession), user)
})

test('the current window session takes precedence over another remembered user', () => {
  const local = memoryStorage()
  const session = memoryStorage()
  saveUserSession(user, true, local, memoryStorage())
  const currentUser = { ...user, userId: 'other-user', username: 'other', roles: [] }
  saveUserSession(currentUser, false, memoryStorage(), session)
  assert.deepEqual(restoreUserSession(local, session), currentUser)
})

test('switching from remembered to session login removes persistent credentials', () => {
  const local = memoryStorage()
  const session = memoryStorage()
  saveUserSession(user, true, local, session)
  const nextUser = { ...user, username: 'next-user', roles: [] }
  saveUserSession(nextUser, false, local, session)
  assert.equal(local.getItem('keepLoggedIn'), null)
  assert.equal(local.getItem('accessToken'), null)
  assert.deepEqual(restoreUserSession(local, session), nextUser)
  assert.equal(restoreUserSession(local, memoryStorage()), null)
})

test('logout clears both login stores while preserving unrelated preferences', () => {
  const local = memoryStorage()
  const session = memoryStorage()
  local.setItem('theme', 'dark')
  session.setItem('filter', 'brain')
  saveUserSession(user, true, local, session)
  clearUserSession(local, session)
  assert.equal(restoreUserSession(local, session), null)
  assert.equal(local.getItem('theme'), 'dark')
  assert.equal(session.getItem('filter'), 'brain')
  assert.equal(local.getItem('accessToken'), null)
  assert.equal(session.getItem('accessToken'), null)
})

test('malformed roles and incomplete identities are discarded without throwing', () => {
  for (const keepLoggedIn of [true, false]) {
    for (const roles of ['invalid JSON', '{}', '"admin"', '[4]', '["admin", null]']) {
      const local = memoryStorage()
      const session = memoryStorage()
      saveUserSession(user, keepLoggedIn, local, session)
      session.setItem('roles', roles)
      if (keepLoggedIn) local.setItem('roles', roles)
      assert.equal(restoreUserSession(local, session), null)
      assert.equal(session.getItem('accessToken'), null)
      assert.equal(local.getItem('accessToken'), null)
    }
  }
  const local = memoryStorage()
  const session = memoryStorage()
  session.setItem('accessToken', 'legacy-synthetic-token')
  assert.equal(restoreUserSession(local, session), null)
  assert.equal(session.getItem('accessToken'), null)
})

test('local login fields are restored only with an explicit remember preference', () => {
  const local = memoryStorage()
  saveUserSession(user, true, local, memoryStorage())
  local.removeItem('keepLoggedIn')
  assert.equal(restoreUserSession(local, memoryStorage()), null)
  assert.equal(local.getItem('accessToken'), null)
})
