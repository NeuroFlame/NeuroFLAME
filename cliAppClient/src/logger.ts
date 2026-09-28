// Minimal diagnostic logger for the CLI.
//
// stdout is reserved for command results (so `neuroflame ... --json | jq` stays
// clean); everything here goes to stderr. Debug lines only print when
// NEUROFLAME_DEBUG=true.

const debugEnabled = process.env.NEUROFLAME_DEBUG === 'true'

export const logger = {
  debug: (...args: unknown[]): void => {
    if (debugEnabled) console.error('[debug]', ...args)
  },
  info: (...args: unknown[]): void => {
    console.error('[info]', ...args)
  },
  error: (...args: unknown[]): void => {
    console.error('[error]', ...args)
  },
}
