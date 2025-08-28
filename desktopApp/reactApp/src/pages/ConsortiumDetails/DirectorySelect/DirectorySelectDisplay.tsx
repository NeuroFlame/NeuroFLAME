import React, { useRef } from 'react'
import { Box, Button, InputAdornment, TextField, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import WarningIcon from '@mui/icons-material/Warning'

interface DirectorySelectDisplayProps {
  directory: string;
  isEditing: boolean;
  isDifferent: boolean; // Positive flag for save
  onDirectoryChange: (newDirectory: string) => void;
  onSaveDirectory: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void; // Explicit start edit function
  onOpenDirectoryDialog: () => void;
}

export function DirectorySelectDisplay({
  directory,
  isEditing,
  isDifferent,
  onDirectoryChange,
  onOpenDirectoryDialog,
  onSaveDirectory,
  onCancelEdit,
  onStartEdit,
}: DirectorySelectDisplayProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = () => {
    if (inputRef && inputRef.current) {
      inputRef.current.focus()
      onStartEdit()
    }
  }

  const iconDisplay = () => isEditing ? 'none' : ''

  const filePathAbbr = (path: string) => {
    if (path) {
      const parts = path.split('/').slice(-3)
      const newPath = (parts.length === 3 ? '/' : '') + parts.join('/')
      return '...' + newPath
    } else {
      return 'Enter Your Data Directory Path'
    }
  }

  return (
    <>
      <Box p={2} borderRadius={2} marginBottom={2} bgcolor='white'>
        <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
          <Typography variant='h6'>
            Data Directory
          </Typography>
          {!directory && <Tooltip title='You have not entered your Data Directory Path'>
            <WarningIcon color='warning' />
          </Tooltip>}
        </Box>
        {/* TextField for manual directory input, disabled unless in edit mode */}
        <TextField
          size='small'
          inputRef={inputRef}
          placeholder='Enter Your Data Directory Path'
          value={isEditing ? directory : filePathAbbr(directory)}
          onFocus={handleFocus}
          onChange={(e) => onDirectoryChange(e.target.value)}
          multiline={isEditing}
          fullWidth
          variant='outlined'
          sx={{
            margin: '0.5rem 0',
            backgroundColor: isEditing ? 'white' : '#eee',
            outline: 'none',
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position='end' sx={{ display: iconDisplay, cursor: 'pointer' }}>
                <Tooltip title='Edit Directory Path'>
                  <EditIcon
                    sx={{ color: '#888', marginRight: '-5px' }}
                    onClick={handleFocus}
                    aria-label='Edit directory'
                  />
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />
        {!directory && !isEditing && <Box marginBottom='0.5rem'><Typography fontSize='small' align='center'>or</Typography></Box>}
        <Box display='flex' gap={1}>
          {/* Button to trigger the Electron directory picker */}
          {!isEditing && <Button
            variant='contained'
            color='primary'
            fullWidth={!directory}
            onClick={onOpenDirectoryDialog}
            style={{ whiteSpace: 'nowrap', fontSize: '10px', backgroundColor: '#0066FF' }}
                         >
            Browse To Select Data Directory
          </Button>}
          {/* Row of Edit, Save, and Cancel buttons */}
          {isEditing && (
            <Button
              variant='contained'
              onClick={onCancelEdit}
              style={{ fontSize: '10px', backgroundColor: '#888' }}
            >
              Cancel
            </Button>
          )}
          {isDifferent && (
            <Button
              variant='contained'
              color='secondary'
              onClick={onSaveDirectory}
              style={{ fontSize: '10px', backgroundColor: '#2FA84F' }}
              disabled={!isDifferent} // Save only if canSave is true
            >
              Save
            </Button>
          )}
        </Box>
      </Box>
    </>
  )
}
