import React from 'react'
import { Button, Box, Typography } from '@mui/material'
import {
  ComputationListItem as ComputationListItemType,
} from '../../apis/centralApi/generated/graphql' // Import the type
import { useNavigate } from 'react-router-dom'

interface ComputationListItemProps {
  computation: ComputationListItemType;
}

const ComputationListItem: React.FC<ComputationListItemProps> = ({
  computation,
}) => {
  const navigate = useNavigate()

  return (
    <Box
      display='flex'
      flexDirection='row'
      style={{
        background: 'white',
        padding: '1re,',
        marginBottom: '1rem',
      }}
    >
      <Box flex={1}>
        <a onClick={() => navigate(`/computation/details/${computation.id}`)}>
          <Typography variant='h6'>
            {computation.title || 'No Title'}
          </Typography>
        </a>
      </Box>
      <Box>
        <Button
          variant='contained'
          color='primary'
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
