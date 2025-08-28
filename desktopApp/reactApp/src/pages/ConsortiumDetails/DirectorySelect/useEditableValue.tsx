import { useEffect, useState } from 'react'

interface useEditableValueParams {
  fetchValue: () => Promise<string>; // Fetch the value (API call)
  saveValue: (newValue: string) => Promise<void>; // Save the updated value (API call)
}

export function useEditableValue({
  fetchValue,
  saveValue,
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
    console.log('hello')
    setEditableValue(newValue)
  }

  // Save the new value
  const saveEditedValue = async () => {
    if (isDifferent) {
      try {
        await saveValue(editableValue)
        setOriginalValue(editableValue) // Update the original value after saving
        setIsEditing(false) // Exit edit mode after saving
      } catch (err) {
        console.error('Failed to save value:', err)
      }
    }
  }

  // Cancel the edit and revert to the original value
  const cancelEdit = () => {
    setEditableValue(originalValue) // Revert to the original value
    setIsEditing(false) // Exit edit mode
  }

  return {
    editableValue, // The current editable value
    changeValue, // Method to change the value
    saveEditedValue, // Method to save the changed value
    startEdit, // Method to start editing
    cancelEdit, // Method to cancel editing
    isEditing, // Whether we're in edit mode
    isDifferent, // Whether the value is different from the original
  }
}
