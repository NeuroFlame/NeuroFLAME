// The user's preferred way to view markdown notes (computation notes,
// leader notes) — asked once, the first time it's needed, then persisted
// via cliConfig.ts so later sessions don't ask again. Change it anytime
// with `neuroflame notes-style`.

import { loadCliConfig, saveCliConfig, CliConfig } from '../cliConfig.js'
import { ask } from './prompt.js'
import { renderMarkdownToTerminal } from './renderMarkdownAnsi.js'
import { viewMarkdownInBrowser } from './viewMarkdown.js'

export type NotesViewStyle = NonNullable<CliConfig['notesViewStyle']>

export const NOTES_VIEW_STYLES: { value: NotesViewStyle; label: string }[] = [
  { value: 'terminal', label: 'Rendered in the terminal (bold headers, highlighted code, ...)' },
  { value: 'raw', label: 'Raw markdown, printed as-is' },
  { value: 'browser', label: 'Open as HTML in your default browser' },
]

function isNotesViewStyle(value: string): value is NotesViewStyle {
  return NOTES_VIEW_STYLES.some((s) => s.value === value)
}

/** Always prompts, regardless of any already-saved style — used by
 * `neuroflame notes-style` to let the user change a previously-saved
 * choice, which getNotesViewStyle() (saved-choice-wins) can't do. */
export async function promptForStyle(): Promise<NotesViewStyle> {
  console.log('\nHow would you like to view computation/leader notes?')
  NOTES_VIEW_STYLES.forEach((s, i) => console.log(`  ${i + 1}. ${s.label}`))
  for (;;) {
    const answer = await ask(`Choice [1-${NOTES_VIEW_STYLES.length}]: `)
    const idx = Number(answer) - 1
    if (Number.isInteger(idx) && idx >= 0 && idx < NOTES_VIEW_STYLES.length) {
      return NOTES_VIEW_STYLES[idx].value
    }
    console.log(`Please enter a number between 1 and ${NOTES_VIEW_STYLES.length}.`)
  }
}

/**
 * Returns the persisted notes-viewing style, prompting for one (and saving
 * the answer) the first time there isn't one yet. Every call after that
 * reuses the saved choice with no prompt. Does not call closePrompt() —
 * same contract as prompt.ts's other helpers: the caller's own top-level
 * command owns that.
 */
export async function getNotesViewStyle(): Promise<NotesViewStyle> {
  const config = await loadCliConfig()
  if (config.notesViewStyle) return config.notesViewStyle

  const style = await promptForStyle()
  await saveCliConfig({ ...config, notesViewStyle: style })
  console.log('Saved — change anytime with `neuroflame notes-style`.\n')
  return style
}

/**
 * Non-interactive: sets the persisted style directly (`neuroflame
 * notes-style <value>`), or throws for anything else so the caller can
 * report a usage error.
 */
export async function setNotesViewStyle(value: string): Promise<NotesViewStyle> {
  if (!isNotesViewStyle(value)) {
    throw new Error(
      `"${value}" isn't a valid style. Choose one of: ${NOTES_VIEW_STYLES.map((s) => s.value).join(', ')}.`,
    )
  }
  const config = await loadCliConfig()
  await saveCliConfig({ ...config, notesViewStyle: value })
  return value
}

/** Prints/opens `markdown` per `style`. `title` is only used for the
 * browser style's page title. Falls back to the terminal-rendered view if
 * opening a browser fails (headless session, no default browser, ...). */
export async function showNotes(
  title: string,
  markdown: string,
  style: NotesViewStyle,
): Promise<void> {
  if (style === 'raw') {
    console.log(markdown)
    return
  }
  if (style === 'terminal') {
    console.log(renderMarkdownToTerminal(markdown))
    return
  }
  try {
    await viewMarkdownInBrowser(title, markdown)
  } catch (error) {
    console.log(
      `Could not open a browser automatically (${error instanceof Error ? error.message : error}). ` +
        'Falling back to the terminal view:\n',
    )
    console.log(renderMarkdownToTerminal(markdown))
  }
}
