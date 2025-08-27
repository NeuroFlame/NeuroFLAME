import { useEffect, useState } from 'react'
import { RunListItem } from '../../../apis/centralApi/generated/graphql'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { useNavigate } from 'react-router-dom'

export function useLatestRun(consortiumId: string) {
  const { getRunList, subscriptions: { consortiumLatestRunChanged } } = useCentralApi()
  const [latestRun, setLatestRun] = useState<RunListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchRunList = async () => {
    setLoading(true)
    const runList = await getRunList({ consortiumId })

    // Sort the run list by `createdAt` in descending order and set the latest one
    const sortedRunList = runList.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    setLatestRun(sortedRunList[0] || null) // Set the latest run, or `null` if no runs exist
    setLoading(false)
  }

  const navigateToRunDetails = () => {
    if (latestRun) {
      navigate(`/run/details/${latestRun.runId}`)
    }
  }

  const navigateToRunResults = () => {
    if (latestRun) {
      navigate(`/run/results/${consortiumId}/${latestRun.runId}`)
    }
  }

  useEffect(() => {
    fetchRunList()
    const subscription = consortiumLatestRunChanged({ consortiumId }).subscribe({
      next: () => {
        fetchRunList() // Refetch on updates
      },
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [consortiumId])

  return { latestRun, loading, navigateToRunDetails, navigateToRunResults }
}
