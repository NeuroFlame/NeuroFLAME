import { useDirectorySelect } from './useDirectorySelect'
import { DirectorySelectDisplay } from './DirectorySelectDisplay'
import { useUserState } from '../../../contexts/UserStateContext'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { useParams } from 'react-router-dom'
import { useConsortiumDetailsContext } from '../ConsortiumDetailsContext'

export default function DirectorySelect() {
  const {
    editableValue,
    changeValue,
    saveEditedValue,
    startEdit,
    cancelEdit,
    isEditing,
    isDifferent,
    openDirectoryDialogHandler,
  } = useDirectorySelect()

  const { userId } = useUserState()
  const { consortiumSetMemberReady } = useCentralApi()
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const { data: { readyMembers, activeMembers }, refetch } = useConsortiumDetailsContext()

  const isActive = activeMembers.some((m) => m.id === userId)
  const isReady = readyMembers.some((m) => m.id === userId)

  const handleSetReady = async (ready: boolean) => {
    try {
      await consortiumSetMemberReady({ consortiumId, ready })
      refetch()
    } catch (error) {
      console.error('Failed to update ready status:', error)
    }
  }

  return (
    <DirectorySelectDisplay
      directory={editableValue}
      isEditing={isEditing}
      isDifferent={isDifferent}
      onDirectoryChange={changeValue}
      onOpenDirectoryDialog={openDirectoryDialogHandler}
      onSaveDirectory={saveEditedValue}
      onCancelEdit={cancelEdit}
      onStartEdit={startEdit}
      isActive={isActive}
      isReady={isReady}
      onSetReady={handleSetReady}
    />
  )
}
