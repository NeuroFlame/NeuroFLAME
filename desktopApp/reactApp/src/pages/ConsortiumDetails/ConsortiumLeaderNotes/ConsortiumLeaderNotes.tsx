import { Box, Button, Typography } from '@mui/material'
import ConsortiumLeaderNotesDisplay from './ConsortiumLeaderNotesDisplay'
import ConsortiumLeaderNotesEdit from './ConsortiumLeaderNotesEdit'
import { useConsortiumLeaderNotes } from './useConsortiumLeaderNotes'

interface ConsortiumLeaderNotesProps {
  consortiumLeaderNotes: string;
  showAccordion: boolean;
}

export default function ConsortiumLeaderNotes({
  consortiumLeaderNotes,
}: ConsortiumLeaderNotesProps) {
  const {
    isEditing,
    handleEdit,
    handleSave,
    handleCancel,
    isLeader,
  } = useConsortiumLeaderNotes(consortiumLeaderNotes)

  return (
    <Box
      p={2}
      borderRadius={2}
      bgcolor='white'
      marginBottom={0}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          marginBottom: 2,
        }}
      >
        <Typography variant='h6'>
          Leader Notes
        </Typography>
        {!isEditing && isLeader && (
          <Button
            variant='outlined'
            size='small'
            color='primary'
            onClick={handleEdit}
          >
            Edit
          </Button>
        )}
      </Box>
      {isEditing ? (
        <ConsortiumLeaderNotesEdit
          consortiumLeaderNotes={consortiumLeaderNotes}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <ConsortiumLeaderNotesDisplay
          consortiumLeaderNotes={consortiumLeaderNotes}
        />
      )}
    </Box>
  )
}
