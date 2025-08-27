import React from 'react'
import { ComputationListItem } from '../../../../apis/centralApi/generated/graphql'
import { List, ListItem, ListItemText, ListItemAvatar, Avatar, Button } from '@mui/material'

interface ComputationListProps {
  computations: ComputationListItem[];
  onSelect: (computationId: string) => void;
}

const ComputationList: React.FC<ComputationListProps> = ({ computations, onSelect }) => (
  <List>
    {computations.map((computation) => (
      <ListItem key={computation.id} divider sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <ListItemText
          sx={{ maxWidth: '400px' }}
          primary={computation.title}
          secondary={computation.imageName ? `${computation.imageName}` : ''}
        />
        <Button
          variant='contained'
          color='primary'
          data-testid={computation.imageName}
          onClick={() => onSelect(computation.id)}
        >
          Select
        </Button>
      </ListItem>
    ))}
  </List>
)

export default ComputationList
