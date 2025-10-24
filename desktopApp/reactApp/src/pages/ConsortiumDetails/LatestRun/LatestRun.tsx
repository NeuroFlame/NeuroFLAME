// LatestRun.tsx
import React from 'react'
import { useParams } from 'react-router-dom'
import { LatestRunDisplay } from './LatestRunDisplay'
import { useLatestRun } from './useLatestRun'

export function LatestRun() {
  const { consortiumId = '' } = useParams<{ consortiumId: string }>()
  const {
    latestRun,
    loading,
    refreshing,
    navigateToRunDetails,
    navigateToRunResults,
  } = useLatestRun(consortiumId)

  return (
    <LatestRunDisplay
      latestRun={latestRun}
      loading={loading}
      refreshing={refreshing}
      navigateToRunDetails={navigateToRunDetails}
      navigateToRunResults={navigateToRunResults}
    />
  )
}

export default LatestRun