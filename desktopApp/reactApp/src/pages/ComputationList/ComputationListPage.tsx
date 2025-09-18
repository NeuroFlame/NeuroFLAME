import React, { useEffect, useState } from 'react'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { ComputationListItem } from '../../apis/centralApi/generated/graphql' // Import the type
import ComputationList from './ComputationList' // Import the presentation component

const ComputationListPageContainer: React.FC = () => {
  const { getComputationList } = useCentralApi()
  const [
    computationList,
    setComputationList,
  ] = useState<ComputationListItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Function to fetch the computation list
  const fetchComputationList = async () => {
    setLoading(true) // Start loading
    setError(null) // Reset error
    try {
      const result = await getComputationList()
      setComputationList(result || []) // Ensure result is not null
    } catch (err) {
      console.error('Error fetching computation list:', err) // Log the error for debugging
      setError('Failed to fetch computation list.')
    } finally {
      setLoading(false) // Stop loading
    }
  }

  useEffect(() => {
    fetchComputationList() // Initial fetch on component mount
  }, []) // Empty dependency array ensures this runs once on mount

  return (
    <ComputationList
      computationList={computationList}
      loading={loading}
      error={error}
      onReload={fetchComputationList} // Pass reload function as prop
    />
  )
}

export default ComputationListPageContainer
