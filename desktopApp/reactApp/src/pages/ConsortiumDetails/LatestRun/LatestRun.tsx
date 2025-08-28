import { useParams } from 'react-router-dom'
import { useLatestRun } from './useLatestRun'
import { LatestRunDisplay } from './LatestRunDisplay'

export function LatestRun() {
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const {
    latestRun,
    loading,
    navigateToRunDetails,
    navigateToRunResults,
  } = useLatestRun(consortiumId)

  return (
    <LatestRunDisplay
      latestRun={latestRun}
      loading={loading}
      navigateToRunDetails={navigateToRunDetails}
      navigateToRunResults={navigateToRunResults}
    />
  )
}
