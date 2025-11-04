import { useState } from 'react'
import { useEditableValue } from './useEditableValue'
import { useEdgeApi } from '../../../apis/edgeApi/edgeApi'
import { useParams } from 'react-router-dom'
import { useConsortiumDetailsContext } from '../ConsortiumDetailsContext'

export function useComputationLocalParameters() {
    const {
    refetch,
    data: consortiumDetails,
  } = useConsortiumDetailsContext()
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const { getLocalParams, setLocalParams, getMountDir } = useEdgeApi()
  const [isEditing, setIsEditing] = useState(false)
  const [mountDir, setMountDir] = useState('')
  const handleEdit = () => setIsEditing(true)
  const cancelEdit = () => setIsEditing(false)  

  // Use the generic useEditableValue hook for managing value state
  const {
    editableValue,
    changeValue,
    startEdit,
    isDifferent,
    commit,
  } = useEditableValue({
    // Fetch function for the directory
    fetchValue: async () => {
      const mountDir = await getMountDir(consortiumId)
      setMountDir(mountDir);
      const localParams = await getLocalParams(consortiumId, mountDir)
      return localParams
    },
  })

  const handleSave = async (newParameters: string) => {
    try {
      // keep local state in sync with what we’re saving
      changeValue(newParameters)

      await setLocalParams(consortiumId, mountDir, newParameters)
      commit()
    } catch (err) {
      console.error('Failed to save local parameters', err)
    } finally {
      setIsEditing(false)
      refetch()
    }
  }

  return {
    editableValue,
    changeValue,
    startEdit,
    cancelEdit,
    isEditing,
    isDifferent,
    handleEdit,
    handleSave,
    commit
  }
}