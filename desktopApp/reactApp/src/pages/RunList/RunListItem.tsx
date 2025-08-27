import React from 'react'
import { Card, CardContent, CardActions, Typography, Button, Box } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { RunListItem as GeneratedRunListItem } from '../../apis/centralApi/generated/graphql' // Import the generated RunListItem type

interface RunListItemProps {
  run: GeneratedRunListItem; // Use the generated type instead of defining a new one
}

export const RunListItem: React.FC<RunListItemProps> = ({ run }) => {
  const navigate = useNavigate() // Initialize navigation

  const handleViewDetails = () => {
    navigate(`/run/details/${run.runId}`) // Navigate to the run details page
  }

  return (
    <Card sx={{ display: 'flex', marginBottom: 2, boxShadow: 'none', justifyContent: 'space-between' }}>
      <CardContent sx={{ flexSize: '3' }}>
        <Typography variant='h6' component='div' fontWeight='600' gutterBottom>
          {run.consortiumTitle}
        </Typography>
        <Typography variant='body2' color='textSecondary'>
          <strong>Status:</strong> {run.status}
        </Typography>
        <Typography variant='body2' color='textSecondary'>
          <strong>Created At:</strong> {new Date(+run.createdAt).toLocaleString()}
        </Typography>
      </CardContent>
      <CardActions sx={{ flexSize: '1' }}>
        <Box ml='auto'> {/* This will push the button to the right */}
          <Button variant='contained' color='primary' onClick={handleViewDetails}>
            View Details
          </Button>
        </Box>
      </CardActions>
    </Card>
  )
}
