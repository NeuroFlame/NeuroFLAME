import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { QueryGetComputationDetailsArgs } from '../../apis/centralApi/generated/graphql' // Import the generated types

export function useComputationDetails() {
  const computationId = useParams<{ computationId: string }>().computationId as string
  const { getComputationDetails } = useCentralApi()

  // Local state to hold the fetched computation details, loading status, and errors
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [computationDetails, setComputationDetails] = useState<any | null>(null)

  // Function to fetch computation details
  const fetchComputationDetails = async () => {
    try {
      setLoading(true)
      const details = await getComputationDetails({
        computationId,
      } as QueryGetComputationDetailsArgs)
      console.log(details)
      setComputationDetails(details) // Update the computation details state with fetched data
    } catch (err: any) {
      setError(err.message) // Handle any errors that occur during fetch
    } finally {
      setLoading(false) // Stop the loading indicator once fetching is done
    }
  }

  useEffect(() => {
    if (!computationId) return

    // Fetch computation initially
    fetchComputationDetails()
  }, [computationId]) // Re-run the effect when computationId or functions change

  // Return the necessary data and states to be consumed by the component
  return {
    computationDetails,
    loading,
    error,
  }
}
