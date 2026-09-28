// Persists the logged-in session (access token + which server it belongs to)
// between CLI invocations, the same way gh/aws CLIs keep a local credential
// file. Stored at ~/.config/neuroflame-cli/session.json, mode 0600, since the
// access token is a bearer credential.

import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export interface Session {
  httpUrl: string
  wsUrl: string
  accessToken: string
  userId: string
  username: string
  roles: string[]
}

const SESSION_DIR = path.join(os.homedir(), '.config', 'neuroflame-cli')
const SESSION_PATH = path.join(SESSION_DIR, 'session.json')

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await fs.readFile(SESSION_PATH, 'utf8')
    return JSON.parse(raw) as Session
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function saveSession(session: Session): Promise<void> {
  await fs.mkdir(SESSION_DIR, { recursive: true, mode: 0o700 })
  await fs.writeFile(SESSION_PATH, JSON.stringify(session, null, 2), {
    mode: 0o600,
  })
  // Tighten permissions explicitly in case the file already existed
  // (e.g. re-login) with looser permissions from another process/umask.
  await fs.chmod(SESSION_PATH, 0o600)
}

export async function clearSession(): Promise<void> {
  try {
    await fs.unlink(SESSION_PATH)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

export async function requireSession(): Promise<Session> {
  const session = await loadSession()
  if (!session) {
    console.error('Not logged in. Run `neuroflame login` first.')
    process.exit(1)
  }
  return session
}

export { SESSION_PATH }
