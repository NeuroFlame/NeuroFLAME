// Renders markdown to ANSI-styled plain text for terminal display — a
// lighter-weight companion to viewMarkdown.ts's browser view, for when a
// quick, more-readable-in-place terminal view is enough (headers stand
// out, **bold**/*italic*/`code` render as actual bold/italic/highlighted
// text instead of literal asterisks and backticks). Walks marked's own
// token tree (already a dependency, via `marked.lexer`) instead of adding
// marked-terminal, which pulls in half a dozen more packages (chalk,
// cli-highlight, cli-table3, node-emoji, ...) for what this CLI only needs
// a sliver of — consistent with this package's minimal-dependency stance.

import { marked, Token, Tokens } from 'marked'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const ITALIC = '\x1b[3m'
const UNDERLINE = '\x1b[4m'
const STRIKETHROUGH = '\x1b[9m'
const CYAN = '\x1b[36m'

// Respects NO_COLOR (https://no-color.org/) and non-TTY output (piped,
// redirected, or a scripted wizard run) — the same reasoning login.ts
// already applies to prompts: no reason to spray escape codes into a log
// file or a pipe that can't render them.
function colorsEnabled(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
}

function wrap(openCode: string, text: string): string {
  return colorsEnabled() ? `${openCode}${text}${RESET}` : text
}

function renderInline(tokens: Token[] | undefined, fallbackText: string | undefined): string {
  if (!tokens) return fallbackText ?? ''
  return tokens.map(renderInlineToken).join('')
}

function renderInlineToken(token: Token): string {
  switch (token.type) {
    case 'text':
    case 'escape': {
      const t = token as Tokens.Text | Tokens.Escape
      return 'tokens' in t && t.tokens ? renderInline(t.tokens, t.text) : t.text
    }
    case 'strong': {
      const t = token as Tokens.Strong
      return wrap(BOLD, renderInline(t.tokens, t.text))
    }
    case 'em': {
      const t = token as Tokens.Em
      return wrap(ITALIC, renderInline(t.tokens, t.text))
    }
    case 'del': {
      const t = token as Tokens.Del
      return wrap(STRIKETHROUGH, renderInline(t.tokens, t.text))
    }
    case 'codespan':
      return wrap(CYAN, (token as Tokens.Codespan).text)
    case 'link': {
      const t = token as Tokens.Link
      const label = wrap(UNDERLINE, renderInline(t.tokens, t.text))
      return `${label} (${wrap(DIM, t.href)})`
    }
    case 'image': {
      const t = token as Tokens.Image
      return `[image: ${t.text || t.href}]`
    }
    case 'br':
      return '\n'
    default:
      return 'raw' in token ? (token as { raw: string }).raw : ''
  }
}

function renderBlocks(tokens: Token[], indent: string): string {
  const parts: string[] = []
  for (const token of tokens) {
    const rendered = renderBlock(token, indent)
    if (rendered !== null) parts.push(rendered)
  }
  return parts.join('\n\n')
}

function renderBlock(token: Token, indent: string): string | null {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading
      return indent + wrap(BOLD + UNDERLINE, renderInline(t.tokens, t.text))
    }
    case 'paragraph':
    case 'text': {
      const t = token as Tokens.Paragraph | Tokens.Text
      return indent + renderInline(t.tokens, t.text)
    }
    case 'code': {
      const t = token as Tokens.Code
      return t.text
        .split('\n')
        .map((line) => indent + wrap(DIM, `  ${line}`))
        .join('\n')
    }
    case 'blockquote': {
      const t = token as Tokens.Blockquote
      return renderBlocks(t.tokens, indent)
        .split('\n')
        .map((line) => indent + wrap(DIM, '│ ') + line.slice(indent.length))
        .join('\n')
    }
    case 'list': {
      const t = token as Tokens.List
      const lines: string[] = []
      t.items.forEach((item, i) => {
        const bullet = t.ordered ? `${(Number(t.start) || 1) + i}. ` : '- '
        const itemIndent = indent + ' '.repeat(bullet.length)
        const inner = renderBlocks(item.tokens, itemIndent)
        const [first, ...rest] = inner.split('\n')
        lines.push(indent + bullet + first.slice(itemIndent.length))
        lines.push(...rest)
      })
      return lines.join('\n')
    }
    case 'hr':
      return indent + wrap(DIM, '─'.repeat(60))
    case 'table': {
      const t = token as Tokens.Table
      const header = t.header.map((cell) => renderInline(cell.tokens, cell.text)).join('  |  ')
      const rows = t.rows.map((row) =>
        indent + row.map((cell) => renderInline(cell.tokens, cell.text)).join('  |  '),
      )
      return [indent + wrap(BOLD, header), indent + '-'.repeat(60), ...rows].join('\n')
    }
    case 'space':
    case 'html':
      // Notes aren't expected to carry raw HTML — drop it rather than dump
      // literal tags into a terminal.
      return null
    default:
      return 'raw' in token ? indent + (token as { raw: string }).raw : null
  }
}

/** Renders `markdown` to ANSI-styled plain text — bold headers, actual
 * bold/italic/highlighted-code inline styling, indented lists/quotes —
 * instead of dumping the raw markdown source. Falls back to the same
 * content with markdown syntax stripped (no escape codes) when stdout
 * isn't a TTY or NO_COLOR is set. */
export function renderMarkdownToTerminal(markdown: string): string {
  return renderBlocks(marked.lexer(markdown), '')
}
