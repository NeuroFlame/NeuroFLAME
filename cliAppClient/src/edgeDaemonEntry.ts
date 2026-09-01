// The actual body of the process `edgeDaemon.ts` spawns for `neuroflame
// edge start` — invoked via cli.ts's internal `__edge-daemon` subcommand,
// never meant to be run directly by a human. edge-federated-client is a
// real dependency of this package (bundled, run in-process within this
// spawned child — not a separately-installed sibling binary anymore; see
// edgeDaemon.ts for why that changed), so this reuses its own env-var
// config loading exactly the way its own `neuroflame-edge start` does —
// same REQUIRED_ENV/OPTIONAL_ENV names edgeDaemon.ts already sets when it
// spawns this.

import { loadConfigFromEnv, validateEnv } from 'edge-federated-client/dist/envConfig.js'
import { start } from 'edge-federated-client'
import { logger } from 'edge-federated-client/dist/logger.js'

function setupSignalHandlers(): void {
  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down...`)
    // Matches edge-federated-client's own cli.ts: no in-flight-container
    // tracking to wait on here — a run's own container process is left
    // running (same as the desktop app quitting mid-run already does),
    // this just stops the server accepting new requests. `neuroflame edge
    // stop` sends SIGTERM to this exact process.
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

export function runEdgeDaemon(): void {
  const errors = validateEnv()
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`[CONFIG] ${error}`))
    process.exit(1)
  }

  setupSignalHandlers()
  const config = loadConfigFromEnv()
  // No onStaleSession override: this process genuinely is "just this
  // package" (a standalone headless daemon, same as edge-federated-
  // client's own README describes) — exiting on a rejected/stale session
  // is the correct default here, unlike the desktop app embedding this in
  // its own long-lived GUI process.
  start(config)
}
