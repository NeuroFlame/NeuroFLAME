import { clearSession } from '../session.js'

export async function logoutCommand(): Promise<void> {
  await clearSession()
  console.log('Logged out.')
}
