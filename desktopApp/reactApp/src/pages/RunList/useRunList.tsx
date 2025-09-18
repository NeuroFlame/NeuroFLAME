import { useState, useEffect } from 'react'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import {
  QueryGetRunListArgs,
  RunListItem,
} from '../../apis/centralApi/generated/graphql' // Import the generated types
import { useParams } from 'react-router-dom'

export function useRunList() {
  const { consortiumId } = useParams<{ consortiumId: string }>() // Extract consortiumId from the route params
  const { getRunList } = useCentralApi()

  // State to hold the fetched run list, loading status, and errors
  const [runList, setRunList] = useState<RunListItem[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRunList = async () => {
    try {
      setLoading(true)
      const input: QueryGetRunListArgs = consortiumId ? { consortiumId } : {}
      const list = await getRunList(input)
      setRunList(list)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRunList()
  }, [])

  return {
    runList,
    loading,
    error,
    fetchRunList,
  }
}
