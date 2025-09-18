import React, { useEffect, useState } from 'react'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { ConsortiumListItem } from '../../apis/centralApi/generated/graphql' // Import the type
import ConsortiumList from './ConsortiumList' // Import the presentation component

const ConsortiumListPageContainer: React.FC = () => {
  const { getConsortiumList } = useCentralApi()
  const [consortiumList, setConsortiumList] = useState<ConsortiumListItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Function to fetch the consortium list
  const fetchConsortiumList = async () => {
    setLoading(true) // Start loading
    setError(null) // Reset error
    try {
      const result = await getConsortiumList()
      setConsortiumList(result || []) // Ensure result is not null
    } catch (err) {
      console.error('Error fetching consortium list:', err) // Log the error for debugging
      setError('Failed to fetch consortium list.')
    } finally {
      setLoading(false) // Stop loading
    }
  }

  useEffect(() => {
    fetchConsortiumList() // Initial fetch on component mount
  }, []) // Empty dependency array ensures this runs once on mount

  return (
    <ConsortiumList
      consortiumList={consortiumList}
      loading={loading}
      error={error}
      onReload={fetchConsortiumList} // Pass reload function as prop
    />
  )
}

export default ConsortiumListPageContainer
