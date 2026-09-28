// A local memory of "which local folder did this identity last use as the
// data directory for this consortium, on this machine" — separate from
// cliConfig.ts (server URLs) and session.ts (who's logged in).
//
// Why this needs to exist at all: an edge client's mount-dir config
// (<EDGE_BASE_DIR>/<consortiumId>/mount_config.json) lives on that specific
// edge client's own filesystem, keyed only by consortiumId. It is NOT
// synced from centralApi and does NOT carry over when the same identity's
// edge client moves — a new standalone `neuroflame-edge` on a different
// port, a different EDGE_BASE_DIR (e.g. to fix an identity collision — see
// "Running a standalone edge client" in the README), a reinstalled
// machine. Server-side, the member still shows active+ready throughout, so
// nothing *looks* wrong until a run actually starts and fails deep inside
// the container with "Failed to load mount configuration".
//
// This cache closes that gap for the one case it safely can: the *same*
// identity, on the *same* machine, standing up a *new* edge client for a
// consortium it's configured before. It's written every time
// `edge set-mount-dir` succeeds, and read by the mount-dir preflight
// (edge.ts's warnAboutMissingMountDirs) to auto-restore a known path onto
// a freshly-connected edge client — after confirming the path still
// exists on disk, since silently pointing a run at a stale/vanished
// directory would be worse than the warning it replaces. It cannot help
// with a genuinely new machine or a first-time path — there's no record
// to restore yet, so that case still just warns, same as before this
// existed.

import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

// userId -> consortiumId -> the last local path set for it on this machine.
export type MountDirCache = Record<string, Record<string, string>>

const CACHE_DIR = path.join(os.homedir(), '.config', 'neuroflame-cli')
const CACHE_PATH = path.join(CACHE_DIR, 'mount-dirs.json')

export async function loadMountDirCache(): Promise<MountDirCache> {
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8')
    return JSON.parse(raw) as MountDirCache
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }
    throw error
  }
}

/** Records that `userId` used `mountDir` for `consortiumId`, most recently. */
export async function rememberMountDir(
  userId: string,
  consortiumId: string,
  mountDir: string,
): Promise<void> {
  const cache = await loadMountDirCache()
  cache[userId] = { ...cache[userId], [consortiumId]: mountDir }
  await fs.mkdir(CACHE_DIR, { recursive: true, mode: 0o700 })
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2))
}

export { CACHE_PATH }
