import { useMemo } from 'react'
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'

export type ConsortiumSortOrder = 'newest' | 'oldest'

export interface ConsortiumFilterType {
  name: string;
  sortOrder: ConsortiumSortOrder;
}

export const DEFAULT_CONSORTIUM_FILTER: ConsortiumFilterType = {
  name: '',
  sortOrder: 'newest',
}

interface ConsortiumFilterProps {
  filter: ConsortiumFilterType;
  onFilterChange: (filter: ConsortiumFilterType) => void;
}

const ConsortiumFilter = ({ filter, onFilterChange }: ConsortiumFilterProps) => {
  const hasActiveFilters = useMemo(
    () => Boolean(filter.name.trim()) || filter.sortOrder !== 'newest',
    [filter],
  )

  const handleSortChange = (event: SelectChangeEvent<ConsortiumSortOrder>) => {
    onFilterChange({
      ...filter,
      sortOrder: event.target.value as ConsortiumSortOrder,
    })
  }

  const handleClearFilters = () => {
    onFilterChange(DEFAULT_CONSORTIUM_FILTER)
  }

  return (
    <Box
      display='flex'
      flexWrap='wrap'
      gap={2}
      p={2}
      mb={4}
      border={1}
      borderColor='divider'
      borderRadius={2}
      alignItems='center'
    >
      <TextField
        size='small'
        label='Filter by Name'
        value={filter.name}
        onChange={(event) =>
          onFilterChange({
            ...filter,
            name: event.target.value,
          })}
        sx={{ minWidth: 260, flex: 1 }}
      />

      <FormControl size='small' sx={{ minWidth: 220 }}>
        <InputLabel id='consortium-sort-label'>Sort by Date</InputLabel>
        <Select
          labelId='consortium-sort-label'
          value={filter.sortOrder}
          label='Sort by Date'
          onChange={handleSortChange}
        >
          <MenuItem value='newest'>Newest First</MenuItem>
          <MenuItem value='oldest'>Oldest First</MenuItem>
        </Select>
      </FormControl>

      <Button
        variant='outlined'
        onClick={handleClearFilters}
        disabled={!hasActiveFilters}
        sx={{ ml: 'auto' }}
      >
        Clear Filters
      </Button>
    </Box>
  )
}

export default ConsortiumFilter
