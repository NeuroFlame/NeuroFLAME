import React, { useMemo, useState } from 'react'
import {
  Typography,
  Button,
  Box,
  CircularProgress,
  Container,
  Divider,
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
import { useUserState } from '../../contexts/UserStateContext'
import { filterConsortiumList } from './filterConsortiumList'

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
  const { userId } = useUserState()
  const [filter, setFilter] = useState<ConsortiumFilterType>(DEFAULT_CONSORTIUM_FILTER)

  const filteredConsortiumList = useMemo(
    () => filterConsortiumList(consortiumList, filter, userId),
    [consortiumList, filter, userId],
  )
  const isMember = (consortium: ConsortiumListItemType) =>
    Boolean(userId) && consortium.members.some((member) => member.id === userId)
  const consortiumSections = [
    {
      title: 'Your Consortia',
      items: filteredConsortiumList.filter(isMember),
      emptyMessage: filter.name.trim() ? 'No consortia match your filter.' : 'You have not joined any consortia.',
    },
    {
      title: 'Public Consortia',
      items: filteredConsortiumList.filter((consortium) => !isMember(consortium)),
      emptyMessage: filter.name.trim() ? 'No consortia match your filter.' : 'No other consortia available.',
    },
  ]

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
          consortiumSections.map(({ title, items, emptyMessage }) => (
            <Box component='section' key={title} sx={{ mb: 4 }}>
              <Divider textAlign='left' sx={{ mb: 2 }}>
                <Typography variant='h6' component='h2' sx={{ color: 'text.secondary' }}>
                  {title}
                </Typography>
              </Divider>
              {items.length === 0 ? (
                <Typography color='text.secondary' sx={{ py: 2 }}>
                  {emptyMessage}
                </Typography>
              ) : (
                items.map((consortium) => (
                  <ConsortiumListItem
                    key={consortium.id}
                    consortium={consortium}
                    onReload={onReload}
                  />
                ))
              )}
            </Box>
          ))
        )}
      </Box>
    </Container>
  )
}

export default ConsortiumList
