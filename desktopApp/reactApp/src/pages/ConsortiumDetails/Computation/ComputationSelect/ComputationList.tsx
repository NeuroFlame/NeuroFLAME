import React from 'react'
import {
  ComputationListItem,
} from '../../../../apis/centralApi/generated/graphql'
import { List, ListItem, ListItemText, Button } from '@mui/material'

interface ComputationListProps {
  computations: ComputationListItem[];
  disabledComputationIds?: string[];
  disabledReasons?: Record<string, string>;
  onSelect: (computationId: string) => void;
}

const ComputationList: React.FC<ComputationListProps> = ({
  computations,
  disabledComputationIds = [],
  disabledReasons = {},
  onSelect,
}) => (
  <List>
    {computations.map((computation) => (
      <ListItem
        key={computation.id}
        divider
        sx={{ display: 'flex', justifyContent: 'space-between' }}
      >
        <ListItemText
          sx={{ maxWidth: '400px' }}
          primary={computation.title}
          secondary={
            disabledReasons[computation.id]
              ? `${computation.imageName} - ${disabledReasons[computation.id]}`
              : computation.imageName
          }
        />
        <Button
          variant='contained'
          color='primary'
          data-testid={computation.imageName}
          disabled={disabledComputationIds.includes(computation.id)}
          onClick={() => onSelect(computation.id)}
        >
          Select
        </Button>
      </ListItem>
    ))}
  </List>
)

export default ComputationList
