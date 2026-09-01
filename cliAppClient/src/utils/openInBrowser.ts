// Shared by anything that wants to hand the user a URL or local file in
// their default browser instead of printing it — edge.ts's `open-results`,
// and the wizard's markdown-notes viewer.

import { spawn } from 'child_process'

/** `open` on macOS, `start` on Windows, `xdg-open` elsewhere. Works the same
 * for a remote URL and a local file path (e.g. a temp .html file) — the OS
 * opener picks the right handler for whatever it's given either way. */
export function openInBrowser(target: string): Promise<void> {
  const platform = process.platform
  const opener = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open'
  return new Promise((resolve, reject) => {
    const child = spawn(opener, [target], { stdio: 'ignore', shell: platform === 'win32' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`"${opener}" exited with code ${code}`))
    })
  })
}
