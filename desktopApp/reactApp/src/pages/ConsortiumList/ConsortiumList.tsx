import React, { useMemo, useState } from 'react'
import {
  Typography,
  Button,
  Box,
  CircularProgress,
  Container,
} from '@mui/material'
import ReplayIcon from '@mui/icons-material/Replay'
import {
  ConsortiumListItem as ConsortiumListItemType,
} from '../../apis/centralApi/generated/graphql'
import ConsortiumListItem from './ConsortiumListItem'
import ConsortiumFilter, {
  ConsortiumFilterType,
  DEFAULT_CONSORTIUM_FILTER,
} from './ConsortiumFilter'
import { useNavigate } from 'react-router-dom'

interface ConsortiumListProps {
  consortiumList: ConsortiumListItemType[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
}

const ConsortiumList: React.FC<ConsortiumListProps> = ({
  consortiumList,
  loading,
  error,
  onReload,
}) => {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ConsortiumFilterType>(DEFAULT_CONSORTIUM_FILTER)

  const filteredConsortiumList = useMemo(() => {
    if (consortiumList.length === 0) {
      return consortiumList
    }

    const searchTerm = filter.name.trim().toLowerCase()
    const newestFirst = filter.sortOrder === 'newest'

    const list = searchTerm
      ? consortiumList.filter(({ title }) => (title || '').toLowerCase().includes(searchTerm))
      : consortiumList

    if (list.length <= 1) {
      return list
    }

    const sortable = searchTerm ? list : list.slice()
    return sortable.sort((a, b) => {
      const dateDiff = +b.createdAt - +a.createdAt
      return newestFirst ? dateDiff : -dateDiff
    })
  }, [consortiumList, filter.name, filter.sortOrder])

  // Loading state
  if (loading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        minHeight='100vh'
      >
        <CircularProgress />
      </Box>
    )
  }

  // Error state
  if (error) {
    return (
      <Container>
        <Box
          display='flex'
          flexDirection='column'
          justifyContent='center'
          alignItems='center'
          marginTop={2}
        >
          <Button
            variant='contained'
            color='primary'
            onClick={onReload}
            sx={{ marginBottom: 2 }}
          >
            Reload
          </Button>
          <Typography variant='h6' color='error' align='center'>
            {error}
          </Typography>
        </Box>
      </Container>
    )
  }

  // Success state (show list and reload button at the top)
  return (
    <Container maxWidth='lg'>
      <Box display='flex' flexDirection='row' marginTop={4} marginBottom={2}>
        <Box flex={1}>
          <Typography variant='h4' gutterBottom align='left'>
            Consortium List
          </Typography>
        </Box>
        <Box>
          <Button
            variant='outlined'
            color='primary'
            onClick={() => navigate('/consortium/create/')}
            sx={{ marginRight: '1rem' }}
          >
            Create A New Consortium
          </Button>
          <Button variant='contained' color='primary' onClick={onReload}>
            Reload
            <ReplayIcon sx={{ fontSize: '1rem' }} />
          </Button>
        </Box>
      </Box>
      <ConsortiumFilter filter={filter} onFilterChange={setFilter} />
      <Box>
        {filteredConsortiumList.length === 0 ? (
          <Typography color='text.secondary' align='center' sx={{ py: 4 }}>
            {consortiumList.length === 0
              ? 'No consortia found.'
              : 'No consortia match your filter.'}
          </Typography>
        ) : (
          filteredConsortiumList.map((consortium) => (
            <ConsortiumListItem
              key={consortium.id}
              consortium={consortium}
              onReload={onReload}
            />
          ))
        )}
      </Box>
    </Container>
  )
}

export default ConsortiumList
