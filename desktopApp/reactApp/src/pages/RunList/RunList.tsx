import { useEffect, useMemo, useState } from 'react'
import { useRunList } from './useRunList' // Import the custom hook for fetching run list
import {
  CircularProgress,
  Container,
  List,
  Typography,
  Box,
  Alert,
  Button,
} from '@mui/material'
import ReplayIcon from '@mui/icons-material/Replay'
import { RunListItem } from './RunListItem'
import RunFilter, { RunFilterType } from './RunFilter'
import { useStarredRuns } from './useStarredRuns'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { ConsortiumListItem, RunListItem as RunListItemType } from '../../apis/centralApi/generated/graphql'
import { useUserState } from '../../contexts/UserStateContext'
import {
  DEFAULT_RUN_FILTER,
  readRunFilterFromStorage,
  writeRunFilterToStorage,
} from './runFilterStorage'

export function RunList() {
  const { userId } = useUserState()
  const { getConsortiumList } = useCentralApi()
  const { runList, loading, error, fetchRunList } = useRunList()
  const { starredIds, toggleStar, isStarred } = useStarredRuns(userId)
  const [consortiumList, setConsortiumList] = useState<ConsortiumListItem[]>([])
  const [filter, setFilter] = useState<RunFilterType>(DEFAULT_RUN_FILTER)

  useEffect(() => {
    if (!userId) {
      setFilter(DEFAULT_RUN_FILTER)
      return
    }

    const { filter: storedFilter } = readRunFilterFromStorage(userId)
    setFilter(storedFilter)
  }, [userId])

  const handleFilterChange = (nextFilter: RunFilterType) => {
    setFilter(nextFilter)
    writeRunFilterToStorage(userId, { filter: nextFilter })
  }

  const runs: RunListItemType[] = useMemo(() => {
    if (!runList || runList.length === 0) {
      return []
    }

    return runList.filter((run) => {
      if (filter.consortia.length > 0 && !filter.consortia.includes(run.consortiumId)) {
        return false
      }

      if (filter.statuses.length > 0) {
        const runStatus = run.status.toLowerCase()
        const matches = filter.statuses.some((s) => s.toLowerCase() === runStatus)
        if (!matches) {
          return false
        }
      }

      const createdMs = +run.createdAt
      if (filter.startDate) {
        const startMs = new Date(`${filter.startDate}T00:00:00`).getTime()
        if (createdMs < startMs) {
          return false
        }
      }

      if (filter.endDate) {
        const endMs = new Date(`${filter.endDate}T23:59:59.999`).getTime()
        if (createdMs > endMs) {
          return false
        }
      }

      if (filter.isStarredOnly && !starredIds.has(run.runId)) {
        return false
      }

      return true
    })
  }, [runList, filter, starredIds])

  const hasActiveFilters = useMemo(
    () =>
      filter.consortia.length > 0 ||
      filter.statuses.length > 0 ||
      Boolean(filter.startDate) ||
      Boolean(filter.endDate) ||
      filter.isStarredOnly,
    [filter],
  )

  const fetchConsortiumList = async () => {
    try {
      const result = await getConsortiumList()
      setConsortiumList(result || [])
    } catch (err) {
      setConsortiumList([])
    }
  }

  useEffect(() => {
    fetchConsortiumList()
  }, [])

  return (
    <Container maxWidth='lg'>
      <Box
        display='flex'
        flexDirection='row'
        marginTop={4}
        marginBottom={2}
        justifyContent='space-between'
        alignItems='center'
      >
        <Typography variant='h4' gutterBottom>
          Run List
        </Typography>

        {/* Button to refetch the run list */}
        <Button
          variant='contained'
          color='primary'
          onClick={fetchRunList} sx={{ mb: 2 }}
        >
          Reload
          <ReplayIcon sx={{ fontSize: '1rem' }} />
        </Button>
      </Box>

      <RunFilter
        consortiumList={consortiumList}
        filter={filter}
        onFilterChange={handleFilterChange}
      />

      {/* Loading State */}
      {loading && (
        <Box
          display='flex'
          justifyContent='center'
          alignItems='center'
          minHeight='20vh'
        >
          <CircularProgress />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Box mt={2}>
          <Alert severity='error'>{error}</Alert>
        </Box>
      )}

      {/* Run List Display */}
      {runs.length > 0 ? (
        <List>
          {runs.map((run) => (
            <RunListItem
              key={run.runId}
              run={run}
              isStarred={isStarred(run.runId)}
              onToggleStar={() => toggleStar(run.runId)}
            />
          ))}
        </List>
      ) : (
        !loading && (
          <Typography variant='body1' color='textSecondary'>
            {runList && runList.length > 0 && hasActiveFilters
              ? 'No runs match your filters.'
              : 'No runs available.'}
          </Typography>
        )
      )}
    </Container>
  )
}
