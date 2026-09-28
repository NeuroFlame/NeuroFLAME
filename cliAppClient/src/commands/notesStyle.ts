// `neuroflame notes-style [terminal|raw|browser]` — view or change the
// persisted notes-viewing preference (utils/notesStyle.ts) set up the
// first time the wizard or `computation show` needed it.

import { loadCliConfig } from '../cliConfig.js'
import { closePrompt } from '../utils/prompt.js'
import { NOTES_VIEW_STYLES, promptForStyle, setNotesViewStyle } from '../utils/notesStyle.js'
import { usageError } from './shared.js'

export async function notesStyleCommand(args: string[]): Promise<void> {
  const [value] = args

  if (value) {
    if (value.startsWith('--')) {
      usageError('neuroflame notes-style [terminal|raw|browser]')
    }
    try {
      const style = await setNotesViewStyle(value)
      console.log(`Notes will now be shown: ${describe(style)}.`)
    } catch (error) {
      usageError(
        `${error instanceof Error ? error.message : String(error)}\n\n` +
          'neuroflame notes-style [terminal|raw|browser]',
      )
    }
    return
  }

  try {
    const config = await loadCliConfig()
    if (config.notesViewStyle) {
      console.log(`Current style: ${describe(config.notesViewStyle)}`)
      console.log('\nPick a new one, or Ctrl+C to leave it as-is.')
    }
    const style = await promptForStyle()
    await setNotesViewStyle(style)
    console.log(`Notes will now be shown: ${describe(style)}.`)
  } finally {
    closePrompt()
  }
}

function describe(style: string): string {
  return NOTES_VIEW_STYLES.find((s) => s.value === style)?.label ?? style
}
