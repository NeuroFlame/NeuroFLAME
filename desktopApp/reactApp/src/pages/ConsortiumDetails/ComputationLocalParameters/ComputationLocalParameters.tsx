import { HashLink } from 'react-router-hash-link'
import { Button, Box, Typography } from '@mui/material'
import ComputationLocalParametersDisplay from './ComputationLocalParametersDisplay'
import ComputationLocalParametersEdit from './ComputationLocalParametersEdit'
import { useComputationLocalParameters } from './useComputationLocalParameters'

export function ComputationLocalParameters() {
  const {
    editableValue,
    changeValue,
    startEdit,
    cancelEdit,
    isEditing,
    isDifferent,
    handleEdit,
    handleSave
  } = useComputationLocalParameters()

  return (
    <Box p={2} borderRadius={2} marginBottom={0} bgcolor='white'>
      <Typography variant='h6' gutterBottom>
        Local Settings{' '}
        <span style={{ fontSize: '12px', color: 'black' }}>
          (local_parameters.json)
        </span>
      </Typography>
      {isEditing ? (
        <ComputationLocalParametersEdit
          ComputationLocalParameters={editableValue as string}
          onSave={handleSave}
          onCancel={cancelEdit}
          startEdit={startEdit}
          isDifferent={isDifferent}
          changeValue={changeValue}
          isEditing={isEditing}
        />
      ) : (
        <ComputationLocalParametersDisplay
          ComputationLocalParameters={editableValue as string}
        />
      )}
      <Box display='flex' justifyContent='space-between' alignItems='center'>
        {!isEditing &&  (
          <Button
            variant='outlined'
            color='primary'
            onClick={handleEdit}
          >
            Edit
          </Button>
        )}
      </Box>
    </Box>
  )
};

export default ComputationLocalParameters
