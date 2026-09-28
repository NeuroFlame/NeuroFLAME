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
import { marked, Renderer } from 'marked'
import { openInBrowser } from './openInBrowser.js'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;')
}

// marked.parse()'s default renderer passes raw HTML and link/image hrefs
// straight through unsanitized (confirmed live: a <script> block and a
// javascript: href both come out verbatim) — fine for the ANSI terminal
// renderer (renderMarkdownAnsi.ts already drops HTML tokens outright and
// only ever prints an href as inert text, never navigates to it), but this
// writes real HTML to a real file that gets opened in a real browser.
// Computation/leader notes are written by other consortium members, not
// necessarily fully trusted, so this needs to actually be safe, not just
// "unlikely to matter." Strips raw HTML entirely and blocks script-capable
// URL schemes on links/images — stripping whitespace first (the standard
// sanitizer trick, same as DOMPurify) so an obfuscated scheme like
// "java script:" (a literal space) can't slip past the check.
const DANGEROUS_URL_SCHEME = /^(?:javascript|data|vbscript|file):/i

function isSafeUrl(href: string): boolean {
  const cleaned = href.replace(/\s/g, '')
  return !DANGEROUS_URL_SCHEME.test(cleaned)
}

function createSafeRenderer(): Renderer {
  const renderer = new Renderer()
  renderer.html = () => ''
  renderer.link = (href, title, text) => {
    const safeHref = isSafeUrl(href) ? href : '#'
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
    return `<a href="${escapeAttr(safeHref)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
  }
  renderer.image = (href, title, text) => {
    if (!isSafeUrl(href)) return escapeHtml(text)
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
    return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${titleAttr}>`
  }
  return renderer
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
  const html = renderPage(title, await marked.parse(markdown, { renderer: createSafeRenderer() }))
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'neuroflame-notes-'))
  const filePath = path.join(dir, 'notes.html')
  await fs.writeFile(filePath, html)
  await openInBrowser(filePath)
}
