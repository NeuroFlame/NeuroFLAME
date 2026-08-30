// Renders a markdown string (computation notes, leader notes, ...) to a
// small standalone HTML file and opens it in the default browser — an
// alternative to reading it as raw markdown in the terminal, useful once
// notes start using headers/tables/links/code blocks that are hard to
// follow unrendered. The desktop app renders the same content with
// react-markdown, which only outputs React elements, not an HTML string, so
// this uses `marked` instead — the CLI has no React tree to render into.

import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { marked } from 'marked'
import { openInBrowser } from './openInBrowser.js'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         max-width: 780px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.55; color: #1a1a1a; }
  h1, h2, h3 { line-height: 1.25; }
  pre { background: #f4f4f4; padding: 0.75rem 1rem; overflow-x: auto; border-radius: 4px; }
  code { background: #f4f4f4; padding: 0.15rem 0.35rem; border-radius: 3px; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: left; }
  th { background: #f4f4f4; }
  blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1rem; color: #555; }
  img { max-width: 100%; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`
}

/**
 * Writes `markdown` as a rendered HTML file to a fresh temp directory and
 * opens it in the user's default browser. `title` is used only for the
 * page's <title> — it does not need to match a heading in `markdown`.
 */
export async function viewMarkdownInBrowser(title: string, markdown: string): Promise<void> {
  const html = renderPage(title, await marked.parse(markdown))
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'neuroflame-notes-'))
  const filePath = path.join(dir, 'notes.html')
  await fs.writeFile(filePath, html)
  await openInBrowser(filePath)
}
