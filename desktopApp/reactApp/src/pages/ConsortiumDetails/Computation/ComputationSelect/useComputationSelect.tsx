// src/hooks/useComputationSelect.ts
import { useState, useEffect } from 'react'
import { useCentralApi } from '../../../../apis/centralApi/centralApi'
import { ComputationListItem } from '../../../../apis/centralApi/generated/graphql'
import { useParams } from 'react-router-dom'

export const useComputationSelect = () => {
  const { getComputationList, studySetComputation } = useCentralApi()
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const [computations, setComputations] = useState<ComputationListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComputations = async () => {
    setLoading(true)
    setError(null)

    try {
      const fetchedComputations = await getComputationList()
      setComputations(fetchedComputations)
    } catch (err) {
      setError('Failed to fetch computations.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const selectComputation = async (computationId: string) => {
    await studySetComputation({ consortiumId, computationId })
  }

  // Fetch the computation list when the hook is first called
  useEffect(() => {
    fetchComputations()
  }, [consortiumId])

  return { computations, loading, error, selectComputation }
}
