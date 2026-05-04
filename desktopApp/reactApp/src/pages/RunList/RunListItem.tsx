import React from 'react'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  IconButton,
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { useNavigate } from 'react-router-dom'
import { RunListItem as RunListItemType } from '../../apis/centralApi/generated/graphql'

interface RunListItemProps {
  run: RunListItemType;
  isStarred: boolean;
  onToggleStar: () => void;
}

export const RunListItem: React.FC<RunListItemProps> = ({ run, isStarred, onToggleStar }) => {
  const navigate = useNavigate() // Initialize navigation

  const handleViewDetails = () => {
    navigate(`/run/details/${run.runId}`) // Navigate to the run details page
  }

  return (
    <Card
      sx={{
        display: 'flex',
        marginBottom: 2,
        boxShadow: 'none',
        justifyContent: 'space-between',
      }}
    >
      <CardContent sx={{ flexSize: '3' }}>
        <Box display='flex' justifyContent='space-between' alignItems='flex-start' gap={1}>
          <Typography variant='h6' component='div' fontWeight='600' gutterBottom>
            {run.consortiumTitle}
          </Typography>
          <IconButton
            size='small'
            aria-label={isStarred ? 'Unstar run' : 'Star run'}
            onClick={(event) => {
              event.stopPropagation()
              onToggleStar()
            }}
            color={isStarred ? 'warning' : 'default'}
          >
            {isStarred ? <StarIcon fontSize='small' /> : <StarBorderIcon fontSize='small' />}
          </IconButton>
        </Box>
        <Typography variant='body2' color='textSecondary'>
          <strong>Status:</strong> {run.status}
        </Typography>
        <Typography variant='body2' color='textSecondary'>
          <strong>Created At:</strong>{' '}
          {new Date(+run.createdAt).toLocaleString()}
        </Typography>
      </CardContent>
      <CardActions sx={{ flexSize: '1' }}>
        <Box ml='auto'> {/* This will push the button to the right */}
          <Button
            variant='contained'
            color='primary'
            onClick={handleViewDetails}
          >
            View Details
          </Button>
        </Box>
      </CardActions>
    </Card>
  )
}
