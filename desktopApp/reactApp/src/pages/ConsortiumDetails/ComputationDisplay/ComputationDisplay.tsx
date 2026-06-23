import React, { useEffect, useRef, useMemo } from 'react'
import { Computation } from '../../../apis/centralApi/generated/graphql'
import { Box, Typography, Card, CardContent, IconButton, Tooltip } from '@mui/material'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import { Maybe } from 'graphql/jsutils/Maybe'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useConsortiumDetailsContext } from '../ConsortiumDetailsContext'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')

const ComputationDisplay: React.FC<{
  notesHeading: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}> = ({ notesHeading, expanded, onToggleExpand }) => {
  const { data: consortiumDetails } = useConsortiumDetailsContext()
  const computation =
    consortiumDetails?.studyConfiguration?.computation as Maybe<Computation>

  const rootRef = useRef<HTMLDivElement | null>(null)

  // React-Markdown custom renderers
  const markdownComponents: Components = useMemo(
    () => ({
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
    }),
    [],
  )

  // Propagate data-col from <th> to matching <td> cells
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    root.querySelectorAll('table').forEach((table) => {
      const headerRow = table.querySelector('thead tr')
      if (!headerRow) return

      const ths = Array.from(
        headerRow.querySelectorAll<HTMLTableCellElement>('th'),
      )
      const headerSlugs = ths.map((th) => th.getAttribute('data-col') || '')

      Array.from(table.querySelectorAll('tbody tr')).forEach((tr) => {
        const tds = Array.from(tr.querySelectorAll<HTMLTableCellElement>('td'))
        tds.forEach((td, i) => {
          const slug = headerSlugs[i]
          if (slug) td.setAttribute('data-col', slug)
        })
      })
    })
  }, [computation?.notes]) // re-run when markdown changes

  if (!computation) {
    return (
      <Card>
        <CardContent>
          <Typography fontSize='11px'>Computation Notes:</Typography>
        </CardContent>
      </Card>
    )
  }

  const { title, notes, imageName } = computation

  return (
    <Box
      className='computation-notes consortium-summary-card window-height'
      borderRadius={2}
      marginBottom={2}
      bgcolor='white'
    >
      <div id='compnotes' />{/* For Notes anchor placement at 800px wide */}
      <CardContent>
        <Box display='flex' justifyContent='space-between' alignItems='flex-start'>
          <Box flex={1}>
            {notesHeading && (
              <Typography fontSize='11px'>Computation Notes:</Typography>
            )}
            <Typography variant='h5' fontWeight='600' color='black'>
              {title}
            </Typography>
          </Box>
          {onToggleExpand && (
            <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
              <IconButton size='small' onClick={onToggleExpand} sx={{ mt: '-4px', mr: '-8px', display: { xs: 'none', md: 'flex' } }}>
                {expanded ? <CloseFullscreenIcon fontSize='small' /> : <OpenInFullIcon fontSize='small' />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Typography variant='body2' color='textSecondary'>
          {imageName}
        </Typography>
        <Box marginTop='1rem' ref={rootRef}>
          <ReactMarkdown
            className='markdown-wrapper'
            components={markdownComponents}
            remarkPlugins={[remarkGfm]}
          >
            {notes ?? ''}
          </ReactMarkdown>
        </Box>
      </CardContent>
    </Box>
  )
}

export default ComputationDisplay
