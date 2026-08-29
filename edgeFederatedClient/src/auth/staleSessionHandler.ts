import { logger } from '../logger.js'

export type StaleSessionHandler = (reason: string) => void

// Correct default: for the standalone `neuroflame-edge` process this
// package normally is, exiting is exactly right — a systemd unit
// (Restart=always) or a re-run `edge start`/`edge connect` picks a fresh
// session back up cleanly. See start()'s second argument for overriding
// this — needed by anything that embeds this package in-process
// alongside other long-lived work, where exiting here would take the
// whole embedding process down with it, not just this package's part of
// it. (The desktop app's Electron main process genuinely IS this
// process — it calls start() in-process, not as a spawned child — so
// this isn't a hypothetical case.)
const defaultHandler: StaleSessionHandler = (reason) => {
  logger.error(`Session appears stale — exiting: ${reason}`)
  process.exit(1)
}

let handler: StaleSessionHandler = defaultHandler

export function setStaleSessionHandler(newHandler: StaleSessionHandler): void {
  handler = newHandler
}

/** The only call site is reportRunError.ts — see its own comment for why. */
export function onStaleSession(reason: string): void {
  handler(reason)
}
