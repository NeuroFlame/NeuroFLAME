import React, { useState } from 'react'
import { ListItem, ListItemText, Button, Box, Paper, Typography } from '@mui/material'
import { ComputationListItem as ComputationListItemType } from '../../apis/centralApi/generated/graphql' // Import the type
import { useNavigate } from 'react-router-dom'
import { useUserState } from '../../contexts/UserStateContext'

interface ComputationListItemProps {
  computation: ComputationListItemType;
}

const ComputationListItem: React.FC<ComputationListItemProps> = ({ computation }) => {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)

  return (
    <Box display='flex' flexDirection='row' style={{ background: 'white', padding: '1rem', marginBottom: '1rem' }}>
      <Box flex={1}>
        <a onClick={() => navigate(`/computation/details/${computation.id}`)}>
          <Typography variant='h6'>{computation.title || 'No Title'}</Typography>
        </a>
      </Box>
      <Box>
        <Button
          variant='contained'
          color='primary'
          disabled={loading}
          sx={{ ml: 2 }}
          onClick={() => navigate(`/computation/details/${computation.id}`)}
        >
          View
        </Button>
      </Box>
    </Box>
  )
}

export default ComputationListItem
