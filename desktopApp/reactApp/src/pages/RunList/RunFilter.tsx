import { useMemo } from 'react'
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  OutlinedInput,
  Chip,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'
import { ConsortiumListItem } from '../../apis/centralApi/generated/graphql'

const STATUS_OPTIONS = ['Complete', 'Running', 'Failed', 'Pending'] as const

export interface RunFilterType {
  consortia: string[];
  statuses: string[];
  startDate: string;
  endDate: string;
  isStarredOnly: boolean;
}

interface RunFilterProps {
  consortiumList: ConsortiumListItem[];
  filter: RunFilterType;
  onFilterChange: (filter: RunFilterType) => void;
}

const RunFilter = ({ consortiumList, filter, onFilterChange }: RunFilterProps) => {
  const hasActiveFilters = useMemo(
    () =>
      filter.consortia.length > 0 ||
      filter.statuses.length > 0 ||
      Boolean(filter.startDate) ||
      Boolean(filter.endDate) ||
      filter.isStarredOnly,
    [filter],
  )

  const handleConsortiumChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target
    onFilterChange({
      ...filter,
      consortia: value as string[],
    })
  }

  const handleStatusChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target
    onFilterChange({
      ...filter,
      statuses: value as string[],
    })
  }

  const handleClearFilters = () => {
    onFilterChange({
      consortia: [],
      statuses: [],
      startDate: '',
      endDate: '',
      isStarredOnly: false,
    })
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
      <FormControl size='small' sx={{ minWidth: 260, flex: 1 }}>
        <InputLabel id='run-filter-consortium-label'>Consortium Name</InputLabel>
        <Select
          labelId='run-filter-consortium-label'
          multiple
          value={filter.consortia}
          onChange={handleConsortiumChange}
          input={<OutlinedInput label='Consortium Name' />}
          renderValue={(selected) => (
            <Box display='flex' gap={0.5} flexWrap='wrap'>
              {selected.map((name) => (
                <Chip
                  key={name}
                  label={consortiumList.find((consortium) => consortium.id === name)?.title || name}
                  size='small'
                />
              ))}
            </Box>
          )}
        >
          {consortiumList.map((consortium) => (
            <MenuItem key={consortium.id} value={consortium.id}>
              {consortium.title}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box display='flex' alignItems='center' gap={1} sx={{ minWidth: 320 }}>
        <TextField
          size='small'
          label='Start Date'
          type='date'
          value={filter.startDate}
          onChange={(event) =>
            onFilterChange({
              ...filter,
              startDate: event.target.value,
            })}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
        <Typography variant='body2' color='text.secondary'>
          to
        </Typography>
        <TextField
          size='small'
          label='End Date'
          type='date'
          value={filter.endDate}
          onChange={(event) =>
            onFilterChange({
              ...filter,
              endDate: event.target.value,
            })}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Box>

      <FormControl size='small' sx={{ minWidth: 220 }}>
        <InputLabel id='run-filter-status-label'>Status</InputLabel>
        <Select
          labelId='run-filter-status-label'
          multiple
          value={filter.statuses}
          onChange={handleStatusChange}
          input={<OutlinedInput label='Status' />}
          renderValue={(selected) => (
            <Box display='flex' gap={0.5} flexWrap='wrap'>
              {selected.map((status) => (
                <Chip key={status} label={status} size='small' />
              ))}
            </Box>
          )}
        >
          {STATUS_OPTIONS.map((status) => (
            <MenuItem key={status} value={status}>
              {status}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box display='flex' alignItems='center' gap={1}>
        <Typography variant='body2' color='text.secondary'>
          Starred Only
        </Typography>
        <Switch
          checked={filter.isStarredOnly}
          onChange={(_, checked) =>
            onFilterChange({
              ...filter,
              isStarredOnly: checked,
            })}
          inputProps={{ 'aria-label': 'Starred Only' }}
        />
      </Box>

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

export default RunFilter
