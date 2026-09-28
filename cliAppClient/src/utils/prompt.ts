// Minimal interactive-prompt helpers, shared by login's username prompt and
// the consortium wizard. No inquirer/prompts dependency — matches the
// rest of this CLI's "no argv-parsing dependency" philosophy.
//
// One readline interface is created lazily and reused across calls, rather
// than a fresh one per question. That matters: creating/closing a
// readline.Interface repeatedly on the same stdin can silently lose
// buffered input between instances (a chunk containing more than one line
// gets partly consumed and discarded on close) — hits piped/scripted input
// hardest, but a human pasting several answers at once could hit it too.
// Callers that prompt more than once in a run (the wizard) must call
// closePrompt() when done, or the open stdin listener keeps the process
// alive after the command should have exited.

import { createInterface, Interface } from 'readline'

let sharedInterface: Interface | null = null

function getInterface(): Interface {
  if (!sharedInterface) {
    sharedInterface = createInterface({ input: process.stdin, output: process.stdout })
  }
  return sharedInterface
}

export function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    getInterface().question(question, (answer) => resolve(answer.trim()))
  })
}

export async function askYesNo(question: string, defaultYes: boolean): Promise<boolean> {
  const suffix = defaultYes ? '[Y/n]' : '[y/N]'
  const answer = (await ask(`${question} ${suffix} `)).toLowerCase()
  if (!answer) return defaultYes
  return answer.startsWith('y')
}

/**
 * Prompts for a 1-based index into a list already printed by the caller.
 * Returns null if the user just presses Enter (a "skip"/"keep current"
 * signal callers interpret themselves), and re-prompts on an out-of-range
 * or non-numeric answer rather than failing the whole wizard over a typo.
 */
export async function askIndex(question: string, count: number): Promise<number | null> {
  const answer = await ask(question)
  if (!answer) return null
  const idx = Number(answer) - 1
  if (!Number.isInteger(idx) || idx < 0 || idx >= count) {
    console.log(`Please enter a number between 1 and ${count}, or press Enter.`)
    return askIndex(question, count)
  }
  return idx
}

/** Releases stdin so a spawned child (e.g. `stdio: 'inherit'`) can use it. */
export function pausePrompt(): void {
  sharedInterface?.pause()
}

export function resumePrompt(): void {
  sharedInterface?.resume()
}

/** Must be called once a multi-question flow is done, or the process hangs. */
export function closePrompt(): void {
  if (sharedInterface) {
    sharedInterface.close()
    sharedInterface = null
  }
}
