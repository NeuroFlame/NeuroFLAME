import { useEffect, useState } from 'react'

interface useEditableValueParams {
  fetchValue: () => Promise<string>; // Fetch the value (API call)
}

export function useEditableValue({
  fetchValue,
}: useEditableValueParams) {
  const [editableValue, setEditableValue] = useState<string>('') // Current value being edited
  const [originalValue, setOriginalValue] = useState<string>('') // Original value fetched
  const [isEditing, setIsEditing] = useState<boolean>(false) // Tracks whether we're in edit mode

  // Check if the value has changed from the original
  const isDifferent = editableValue !== originalValue

  // Fetch the initial value when the component mounts
  useEffect(() => {
    const fetchInitialValue = async () => {
      try {
        const value = await fetchValue()
        setEditableValue(value)
        setOriginalValue(value) // Store the original value for comparison
      } catch (err) {
        console.error('Failed to fetch value:', err)
      }
    }

    fetchInitialValue()
  }, [])

  // Start edit mode
  const startEdit = () => {
    setIsEditing(true)
  }

  // Change the value (e.g., through text input)
  const changeValue = (newValue: string) => {
    setEditableValue(newValue)
  }

  // Cancel the edit and revert to the original value
  const cancelEdit = () => {
    setEditableValue(originalValue) // Revert to the original value
    setIsEditing(false) // Exit edit mode
  }

  const commit = () => setOriginalValue(editableValue)

  return {
    editableValue, // The current editable value
    changeValue, // Method to change the value
    startEdit, // Method to start editing
    cancelEdit, // Method to cancel editing
    isEditing, // Whether we're in edit mode
    isDifferent, // Whether the value is different from the original
    commit, // Method to commit the current value as original
  }
}
