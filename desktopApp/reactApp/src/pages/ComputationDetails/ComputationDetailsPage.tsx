import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  IconButton,
  Typography,
} from '@mui/material'
import { useComputationDetails } from './useComputationDetails'
import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

export default function ComputationDetails() {
  const navigate = useNavigate()
  const { computationDetails, loading, error } = useComputationDetails()
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const handleCopy = () => {
    if (computationDetails?.imageDownloadUrl) {
      navigator.clipboard.writeText(computationDetails.imageDownloadUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')

  // --- react-markdown custom renderers ---
  const markdownComponents: Components = {
    th: ({ children, ...props }) => {
      // derive a stable slug from header text
      const text =
        Array.isArray(children)
          ? children.map((c) => (typeof c === 'string' ? c : '')).join('').trim()
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
  }

  // --- Propagate data-col from <th> to the corresponding <td> cells ---
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
  }, [computationDetails?.notes]) // re-run when markdown changes

  return (
    <Box p={2}>
      {error && (
        <Box mt={2}>
          <Alert severity='error'>{error}</Alert>
        </Box>
      )}

      {computationDetails && (
        <Container maxWidth='lg' sx={{ marginTop: '1rem' }}>
          <Box display='flex' justifyContent='space-between' mx='1rem'>
            <Typography variant='h4'>Computation Details</Typography>
            <Box>
              <Button
                variant='outlined'
                onClick={() => navigate('/computation/list/')}
              >
                Back To Computation List
              </Button>
            </Box>
          </Box>

          <Card sx={{ m: '1rem', p: '2rem' }}>
            <Typography variant='h5' fontWeight={600} color='black'>
              {computationDetails.title}
            </Typography>
            <Typography variant='body2' color='textSecondary'>
              {computationDetails.imageName}
            </Typography>

            <Box mt={2} display='flex' flexDirection='column' alignItems='flex-start'>
              <Typography>Image Download:</Typography>
              <Box display='flex' alignItems='center' mb='1rem' width='100%'>
                <Typography
                  component='code'
                  sx={{
                    bgcolor: '#f5f5f5',
                    p: '4px 8px',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    width: 'calc(100% - 2rem)',
                    lineBreak: 'anywhere',
                  }}
                >
                  {computationDetails.imageDownloadUrl}
                </Typography>
                <IconButton
                  onClick={handleCopy}
                  size='small'
                  aria-label='copy download URL'
                  sx={{ ml: 1 }}
                >
                  <ContentCopyIcon fontSize='small' />
                </IconButton>
                {copied && (
                  <Typography fontSize='0.75rem' color='green' ml={1}>
                    Copied!
                  </Typography>
                )}
              </Box>
            </Box>

            <Box mt='1rem' ref={rootRef}>
              <ReactMarkdown
                className='markdown-wrapper'
                components={markdownComponents}
                remarkPlugins={[remarkGfm]}
              >
                {computationDetails.notes}
              </ReactMarkdown>
            </Box>
          </Card>
        </Container>
      )}

      {!loading && !computationDetails && !error && (
        <Typography variant='body1' color='textSecondary'>
          No run details available.
        </Typography>
      )}
    </Box>
  )
}
