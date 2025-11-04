import React, { useState } from 'react'
import { Button, TextField } from '@mui/material'

interface ComputationLocalParametersEditProps {
  ComputationLocalParameters: string
  onSave: (newParameters: string) => void
  onCancel: () => void
  startEdit: () => void
  isDifferent: boolean
  changeValue: (value: string) => void
  isEditing: boolean
}

export default function ComputationLocalParametersEdit({
  ComputationLocalParameters,
  onSave,
  onCancel,
  changeValue,
}: ComputationLocalParametersEditProps) {
  const [isValidJson, setIsValidJson] = useState(true)

  const saveHandler = () => {
    if (isValidJson) onSave(ComputationLocalParameters)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    changeValue(value)
    try {
      JSON.parse(value)
      setIsValidJson(true)
    } catch {
      setIsValidJson(false)
    }
  }

  return (
    <div>
      <TextField
        fullWidth
        multiline
        rows={10}
        variant="outlined"
        value={ComputationLocalParameters}
        onChange={handleChange}
        error={!isValidJson}
        helperText={!isValidJson ? 'Invalid JSON format' : 'Enter valid JSON'}
      />
      <div style={{ marginTop: 16 }}>
        <Button size="small" variant="contained" onClick={saveHandler} disabled={!isValidJson}>Save</Button>
        <Button size="small" variant="outlined" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}