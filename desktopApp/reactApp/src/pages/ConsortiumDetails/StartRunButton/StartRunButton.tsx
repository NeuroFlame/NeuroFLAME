import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { Button, Typography, CircularProgress } from '@mui/material'

export default function StartRunButton() {
  const { startRun } = useCentralApi()
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [runStarted, setRunStarted] = useState<boolean>(false)

  const handleStartRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await startRun({ input: { consortiumId } })
      setRunId(result.runId)
    } catch (err) {
      setError('Failed to start the run. Please try again.')
    } finally {
      setLoading(false)
      setRunStarted(true)
      const startRunTimeout = setTimeout(() => {
        setRunStarted(false)
      }, 10000)
      // eslint-disable-next-line no-unsafe-finally
      return () => clearTimeout(startRunTimeout)
    }
  }

  return (
    <>
      {loading ? (
        <CircularProgress />
      ) : (
        <Button
          variant='contained'
          onClick={handleStartRun}
          disabled={runStarted} // Disable after a run is started
          sx={{
            marginBottom: '1rem',
            backgroundColor: '#2FB600',
            borderRadius: '1.2rem',
          }}
          fullWidth
        >
          {runStarted ? `Run Started (ID: ${runId})` : 'Start Run'}
        </Button>
      )}

      {error && (
        <Typography mt={2} color='error'>
          {error}
        </Typography>
      )}
    </>
  )
}
