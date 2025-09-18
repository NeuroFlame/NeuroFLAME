import { useDirectorySelect } from './useDirectorySelect'
import { DirectorySelectDisplay } from './DirectorySelectDisplay'

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
    />
  )
}
