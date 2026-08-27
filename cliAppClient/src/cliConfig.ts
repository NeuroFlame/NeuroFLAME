// Persistent CLI-wide preferences — distinct from session.ts's session.json
// (which is about *who's logged in*, and only exists once a login has
// actually succeeded). This is about *this machine's* setup: which servers
// to talk to, settable before any login exists. `neuroflame configure`
// writes this file; `resolveServerUrls`/`resolveEdgeUrl` (config.ts) read
// it as a fallback between env vars and hardcoded defaults.
//
// edgeUrl in particular had no persistence at all before this — it was
// re-exported (or forgotten) every shell session, the root cause of
// repeated wrong-port mixups.

import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export interface CliConfig {
  httpUrl?: string
  wsUrl?: string
  edgeUrl?: string
  // Both default to being derived from edgeUrl (config.ts) rather than
  // asked for separately in `neuroflame configure` — in every setup we've
  // seen (see configs/electronApp1.json) they share edgeUrl's origin. Only
  // set explicitly (env var, or by hand-editing this file) if a real
  // deployment doesn't colocate them the way local dev does.
  edgeWsUrl?: string
  edgeRunResultsUrl?: string
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'neuroflame-cli')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

export async function loadCliConfig(): Promise<CliConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    return JSON.parse(raw) as CliConfig
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }
    throw error
  }
}

export async function saveCliConfig(config: CliConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export { CONFIG_PATH }
