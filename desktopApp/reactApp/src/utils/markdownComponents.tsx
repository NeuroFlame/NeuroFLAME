import { Components } from 'react-markdown'

/**
 * Converts a string to a URL-friendly slug
 */
export const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')

/**
 * Creates markdown components for ReactMarkdown with custom table rendering.
 * The table component wraps tables in a div for styling, and the th component
 * adds data-col attributes for column identification.
 */
export const createMarkdownComponents = (): Components => ({
  th: ({ children, ...props }) => {
    const text =
      Array.isArray(children)
        ? children
            .map((c) => (typeof c === 'string' ? c : ''))
            .join('')
            .trim()
        : typeof children === 'string'
          ? children.trim()
          : ''
    const dataCol = slugify(text || 'col')
    return (
      <th {...props} data-col={dataCol}>
        {children}
      </th>
    )
  },
  table: ({ ...props }) => (
    <div className='table-wrapper'>
      <table {...props} />
    </div>
  ),
})
