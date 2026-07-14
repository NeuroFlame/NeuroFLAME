import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { Button, Typography, CircularProgress } from '@mui/material'
import { useConsortiumDetailsContext } from '../ConsortiumDetailsContext'

export default function StartRunButton() {
  const { startRun } = useCentralApi()
  const {
    data: { activeMembers },
  } = useConsortiumDetailsContext()
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [runStarted, setRunStarted] = useState<boolean>(false)
  const hasActiveParticipants = activeMembers.length > 0

  const handleStartRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await startRun({ input: { consortiumId } })
      setRunId(result.runId)
      setRunStarted(true)
      setTimeout(() => {
        setRunStarted(false)
      }, 10000)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to start the run. Please try again.',
      )
      setRunId(null)
      setRunStarted(false)
    } finally {
      setLoading(false)
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
          disabled={!hasActiveParticipants || runStarted}
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
