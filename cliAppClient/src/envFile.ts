// Loads ~/.config/neuroflame-cli/.env into process.env at startup — for
// non-interactive contexts (a SLURM batch job, systemd, CI) where exporting
// NEUROFLAME_USERNAME/NEUROFLAME_PASSWORD (or any other NEUROFLAME_* env
// var this CLI already reads — NEUROFLAME_HTTP_URL, NEUROFLAME_EDGE_URL,
// etc.) via the job's own environment isn't practical: a batch script has
// no terminal to prompt on, and the job-submission system may not have a
// convenient way to inject secrets as real env vars.
//
// Mirrors centralApi's own dev-start.js pattern — a tiny manual parser, no
// dotenv dependency, matching this CLI's own "no argv-parsing dependency,
// no unnecessary weight" precedent (see utils/prompt.ts's own comment on
// the same principle).
//
// Real environment variables always win: this only fills in keys that
// aren't already set, matching every other precedence rule this CLI
// documents (env var > persisted config > default) — an operator can
// still override a .env value with a one-off export.

import { readFileSync } from 'fs'
import path from 'path'
import os from 'os'

const ENV_FILE_PATH = path.join(os.homedir(), '.config', 'neuroflame-cli', '.env')

export function loadDotEnvFile(): void {
  let content: string
  try {
    content = readFileSync(ENV_FILE_PATH, 'utf8')
  } catch {
    return // no .env file — nothing to do, not an error
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // Strip one layer of matching surrounding quotes, if present — the
    // common way to write a value containing spaces or a leading/trailing
    // space that would otherwise get trimmed above.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1)
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export { ENV_FILE_PATH }
