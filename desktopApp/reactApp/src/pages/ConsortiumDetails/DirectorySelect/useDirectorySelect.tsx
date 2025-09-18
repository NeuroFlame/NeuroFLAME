import { useEditableValue } from './useEditableValue'
import { useEdgeApi } from '../../../apis/edgeApi/edgeApi'
import { electronApi } from '../../../apis/electronApi/electronApi'
import { useParams } from 'react-router-dom'

export function useDirectorySelect() {
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const { getMountDir, setMountDir } = useEdgeApi()
  const { useDirectoryDialog: openDirectoryDialog } = electronApi

  // Use the generic useEditableValue hook for managing value state
  const {
    editableValue,
    changeValue,
    saveEditedValue,
    startEdit,
    cancelEdit,
    isEditing,
    isDifferent,
  } = useEditableValue({
    // Fetch function for the directory
    fetchValue: async () => {
      const mountDir = await getMountDir(consortiumId)
      return mountDir
    },
    // Save function for the directory
    saveValue: async (newDirectory: string) => {
      await setMountDir(consortiumId, newDirectory)
    },
  })

  // Trigger the Electron directory picker
  const openDirectoryDialogHandler = async () => {
    try {
      const {
        canceled,
        error,
        directoryPath,
      } = await openDirectoryDialog(editableValue)
      if (!canceled && !error && directoryPath) {
        changeValue(directoryPath) // Use updateDirectory to set the new value
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error)
    }
  }

  return {
    editableValue,
    changeValue,
    saveEditedValue,
    startEdit,
    cancelEdit,
    isEditing,
    isDifferent,
    openDirectoryDialogHandler,
  }
}
