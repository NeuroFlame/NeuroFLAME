import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TextareaAutosize from 'react-textarea-autosize'
import { Typography, Button, Box, Container } from '@mui/material'
import { useCentralApi } from '../../apis/centralApi/centralApi'

export default function ComputationCreatePage() {
  const [title, setTitle] = useState('')
  const [imageName, setImageName] = useState('')
  const [imageDownloadUrl, setImageDownloadUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const { computationCreate } = useCentralApi()

  const createAndNavigate = async (navPath: string) => {
    try {
      setError(null)
      setLoading(true)
      await computationCreate({
        title,
        imageName,
        imageDownloadUrl,
        notes,
      })
      setLoading(false)
      navigate(`${navPath}`)
    } catch (error) {
      setLoading(false)
      setError('Failed to create Computation')
    }
  }

  const createAndList = async () => {
    await createAndNavigate('/Computation/list')
  }

  return (
    <Container maxWidth='lg'>
      <Box marginTop={4} marginBottom={2}>
        <Box display='flex' flexDirection='row' justifyContent='space-between' marginBottom={2}>
          <Typography variant='h4' align='left'>
            Create New Computation
          </Typography>
          <Button variant='outlined' onClick={() => navigate('/Computation/list')}>
            Back to Computation List
          </Button>
        </Box>
        <Box style={{ background: 'white', padding: '1rem' }}>
          <input
            type='text'
            placeholder='Title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: 'calc(100% - 2rem)', marginBottom: '1rem' }}
          />
          <input
            type='text'
            placeholder='Image Name'
            value={imageName}
            onChange={(e) => setImageName(e.target.value)}
            style={{ width: 'calc(100% - 2rem)', marginBottom: '1rem' }}
          />
          <input
            type='text'
            placeholder='Image Download Url'
            value={imageDownloadUrl}
            onChange={(e) => setImageDownloadUrl(e.target.value)}
            style={{ width: 'calc(100% - 2rem)', marginBottom: '1rem' }}
          />
          <TextareaAutosize
            minRows={3}
            style={{ width: 'calc(100% - 2rem)', marginBottom: '0.5rem' }}
            placeholder='Computation Notes'
            defaultValue={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Box display='flex' gap={2} alignItems='center'>
            <Button variant='contained' onClick={createAndList} disabled={loading} color='success'>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </Box>
      </Box>
    </Container>
  )
}
