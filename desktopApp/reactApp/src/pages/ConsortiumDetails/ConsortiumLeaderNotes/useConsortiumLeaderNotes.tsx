// src/hooks/useComputationParameters.ts
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { useConsortiumDetailsContext } from '../ConsortiumDetailsContext'

export const useConsortiumLeaderNotes = (initialNotes: string) => {
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState(initialNotes)
  const { studySetNotes } = useCentralApi()
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const { refetch, isLeader } = useConsortiumDetailsContext()
  const handleEdit = () => setIsEditing(true)

  const handleSave = async (newNotes: string) => {
    await studySetNotes({ consortiumId, notes: newNotes })
    setNotes(newNotes)
    refetch()
    setIsEditing(false)
  }

  const handleCancel = () => setIsEditing(false)

  return {
    isEditing,
    isLeader,
    notes,
    handleEdit,
    handleSave,
    handleCancel,
  }
}
