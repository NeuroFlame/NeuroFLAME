// Small helpers shared across the per-resource command files.

export { requireSession } from '../session.js'
export type { Session } from '../session.js'

export function printJsonOrHuman(json: boolean, data: unknown, human: string): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2))
  } else {
    console.log(human)
  }
}

/** Throws (caught by cli.ts, which prints it without an "Error:" prefix). */
export function usageError(message: string): never {
  throw new Error(`Usage: ${message}`)
}

export function parseBool(value: string | undefined, label: string): boolean {
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`Expected "true" or "false" for ${label}, got: ${value ?? '(none)'}`)
}

/** Splits trailing positional args like ["a", "b", "c"] past a fixed prefix count. */
export function trailingPositionals(args: string[], fixedCount: number): string[] {
  return args
    .slice(fixedCount)
    .filter((arg) => !arg.startsWith('--'))
}

/**
 * A run reaching Complete or Error is easy to miss in a stream of status
 * lines — this is the "there's more here" nudge, printed alongside that
 * line wherever a run's status gets shown (`run list`, `run
 * watch`/`watch-consortium`). Returns null for non-terminal statuses.
 */
export function terminalStatusHint(
  status: string,
  consortiumId: string,
  runId: string,
): string | null {
  if (status === 'Complete') {
    return (
      `    → results: neuroflame edge open-results ${consortiumId} ${runId}\n` +
      `    → if that looks wrong: neuroflame edge get-run-error ${consortiumId} ${runId}`
    )
  }
  if (status === 'Error') {
    return `    → details: neuroflame run show ${runId}`
  }
  return null
}
