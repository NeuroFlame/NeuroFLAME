import React, { useState } from 'react'
import { Button, TextField } from '@mui/material'

interface ComputationParametersEditProps {
  computationParameters: string;
  onSave: (newParameters: string) => void;
  onCancel: () => void;
}

export default function ComputationParametersEdit({
  computationParameters,
  onSave,
  onCancel,
}: ComputationParametersEditProps) {
  const [parameters, setParameters] = useState(computationParameters)
  const [isValidJson, setIsValidJson] = useState(true)

  const handleSave = () => {
    if (isValidJson) {
      onSave(parameters)
    }
  }

  const handleCancel = () => {
    onCancel()
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setParameters(value)

    // Validate JSON
    try {
      JSON.parse(value)
      setIsValidJson(true)
    } catch (error) {
      setIsValidJson(false)
    }
  }

  return (
    <div>
      <TextField
        fullWidth
        multiline
        rows={10}
        variant='outlined'
        value={parameters}
        onChange={handleChange}
        error={!isValidJson}
        helperText={!isValidJson ? 'Invalid JSON format' : 'Enter valid JSON'}
        data-testid='parameters-textarea'
      />
      <div style={{ marginTop: '16px' }}>
        <Button
          size='small'
          variant='contained'
          color='primary'
          onClick={handleSave}
          disabled={!isValidJson}
          style={{ marginRight: '8px' }}
        >
          Save
        </Button>
        <Button size='small' variant='outlined' onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
