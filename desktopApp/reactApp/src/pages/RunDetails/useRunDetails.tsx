import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { QueryGetRunDetailsArgs, RunDetails as GeneratedRunDetails } from '../../apis/centralApi/generated/graphql' // Import the generated types

export function useRunDetails() {
  const { runId } = useParams<{ runId: string }>() // Extract runId from the route params
  const { getRunDetails, subscriptions: { runDetailsChanged } } = useCentralApi() // Fetch the getRunDetails and runDetailsChanged functions

  // Local state to hold the fetched run details, loading status, and errors
  const [runDetails, setRunDetails] = useState<GeneratedRunDetails | null>(null) // Use the generated RunDetails type
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Function to fetch run details
  const fetchRunDetails = async () => {
    try {
      setLoading(true)
      const details = await getRunDetails({ runId } as QueryGetRunDetailsArgs) // Use the correct input type
      setRunDetails(details) // Update the run details state with fetched data
    } catch (err: any) {
      setError(err.message) // Handle any errors that occur during fetch
    } finally {
      setLoading(false) // Stop the loading indicator once fetching is done
    }
  }

  // Subscribe to changes when the component mounts and fetch details on changes
  useEffect(() => {
    if (!runId) return

    // Fetch run details initially
    fetchRunDetails()

    // Set up the subscription
    const subscription = runDetailsChanged({ runId }).subscribe({
      next: () => {
        // Re-fetch the run details when a change is detected
        fetchRunDetails()
      },
      error: (err: any) => {
        setError(`Subscription error: ${err.message}`)
      },
    })

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [runId]) // Re-run the effect when runId or functions change

  // Return the necessary data and states to be consumed by the component
  return {
    runDetails,
    loading,
    error,
  }
}
