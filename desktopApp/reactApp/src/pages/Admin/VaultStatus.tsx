import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import {
  ComputationListItem,
  PublicUser,
  VaultDatasetMappingInput,
} from '../../apis/centralApi/generated/graphql'

const OFFLINE_THRESHOLD_MS = 90_000

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

function formatLastSeen(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`
  return date.toLocaleDateString()
}

function isOnline(lastHeartbeat: string): boolean {
  const date = new Date(lastHeartbeat)
  const now = new Date()
  return now.getTime() - date.getTime() < OFFLINE_THRESHOLD_MS
}

function toDatasetMappingRecord(
  mappings: Array<{ computationId: string; datasetKey: string }>,
): Record<string, string> {
  const mappingRecord: Record<string, string> = {}
  for (const mapping of mappings) {
    mappingRecord[mapping.computationId] = mapping.datasetKey
  }
  return mappingRecord
}

interface VaultRowProps {
  allComputations: ComputationListItem[]
  saveError: string | null
  savingAction: 'allowed' | 'datasetMappings' | null
  savingVaultId: string | null
  vault: PublicUser
  onSaveAllowedComputations: (
    vaultId: string,
    computationIds: string[],
  ) => Promise<void>
  onSaveDatasetMappings: (
    vaultId: string,
    mappings: VaultDatasetMappingInput[],
  ) => Promise<void>
}

function VaultRow({
  allComputations,
  saveError,
  savingAction,
  savingVaultId,
  vault,
  onSaveAllowedComputations,
  onSaveDatasetMappings,
}: VaultRowProps) {
  const allowedComputations = vault.vault?.allowedComputations ?? []
  const persistedDatasetMappings = vault.vault?.datasetMappings ?? []
  const availableDatasets = vault.vaultStatus?.availableDatasets ?? []
  const [expanded, setExpanded] = useState(false)
  const [selectedComputationIds, setSelectedComputationIds] = useState<string[]>(
    allowedComputations.map((computation) => computation.id),
  )
  const [selectedDatasetMappings, setSelectedDatasetMappings] = useState<Record<string, string>>(
    toDatasetMappingRecord(persistedDatasetMappings),
  )

  useEffect(() => {
    setSelectedComputationIds(
      allowedComputations.map((computation) => computation.id),
    )
  }, [allowedComputations])

  useEffect(() => {
    setSelectedDatasetMappings(toDatasetMappingRecord(persistedDatasetMappings))
  }, [persistedDatasetMappings])

  const status = vault.vaultStatus
  const online = status ? isOnline(status.lastHeartbeat) : false
  const hasRunningComputations = (status?.runningComputations?.length ?? 0) > 0
  const isSaving = savingVaultId === vault.id
  const isSavingAllowed = isSaving && savingAction === 'allowed'
  const isSavingDatasetMappings = isSaving && savingAction === 'datasetMappings'
  const persistedDatasetMappingRecord = toDatasetMappingRecord(persistedDatasetMappings)
  const hasUnsavedAllowedComputationChanges =
    selectedComputationIds.length !== allowedComputations.length ||
    selectedComputationIds.some(
      (id) => !allowedComputations.some((computation) => computation.id === id),
    )

  const hasUnsavedDatasetMappingChanges = allowedComputations.some(
    (computation) =>
      (selectedDatasetMappings[computation.id] ?? '') !==
      (persistedDatasetMappingRecord[computation.id] ?? ''),
  )

  const toggleComputation = (computationId: string) => {
    setSelectedComputationIds((currentIds) => {
      if (currentIds.includes(computationId)) {
        return currentIds.filter((id) => id !== computationId)
      }

      return [...currentIds, computationId]
    })
  }

  const handleDatasetMappingChange = (
    computationId: string,
    event: SelectChangeEvent<string>,
  ) => {
    const datasetKey = event.target.value
    setSelectedDatasetMappings((currentMappings) => ({
      ...currentMappings,
      [computationId]: datasetKey,
    }))
  }

  const mappedDatasetCount = allowedComputations.filter(
    (computation) => (persistedDatasetMappingRecord[computation.id] ?? '').length > 0,
  ).length

  return (
    <>
      <TableRow
        sx={{
          '&:hover': { backgroundColor: '#f5f5f5' },
          backgroundColor: online ? 'inherit' : '#ffebee',
        }}
      >
        <TableCell>
          <IconButton size="small" onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {online ? (
              <CheckCircleIcon color="success" fontSize="small" />
            ) : (
              <ErrorIcon color="error" fontSize="small" />
            )}
            <Typography fontWeight="medium">
              {vault.vault?.name || vault.username}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          {online ? (
            <Chip label="Online" size="small" color="success" />
          ) : (
            <Chip label="Offline" size="small" color="error" />
          )}
        </TableCell>
        <TableCell>{status?.version || '-'}</TableCell>
        <TableCell>{status ? formatUptime(status.uptime) : '-'}</TableCell>
        <TableCell>
          {status ? formatLastSeen(status.lastHeartbeat) : 'Never'}
        </TableCell>
        <TableCell>
          <Chip
            label={`${allowedComputations.length} allowed`}
            size="small"
            color={allowedComputations.length > 0 ? 'primary' : 'default'}
            variant="outlined"
          />
        </TableCell>
        <TableCell>
          {hasRunningComputations ? (
            <Chip
              label={`${status!.runningComputations.length} running`}
              size="small"
              color="primary"
            />
          ) : (
            <Typography color="text.secondary">None</Typography>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2, display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Allowed Computations
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 1,
                  }}
                >
                  {allComputations.map((computation) => (
                    <FormControlLabel
                      key={computation.id}
                      control={(
                        <Checkbox
                          checked={selectedComputationIds.includes(computation.id)}
                          onChange={() => toggleComputation(computation.id)}
                        />
                      )}
                      label={(
                        <Box>
                          <Typography variant="body2">{computation.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {computation.imageName}
                          </Typography>
                        </Box>
                      )}
                      sx={{ alignItems: 'flex-start', marginRight: 0 }}
                    />
                  ))}
                </Box>
                {saveError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {saveError}
                  </Alert>
                )}
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    disabled={isSaving || !hasUnsavedAllowedComputationChanges}
                    onClick={() =>
                      onSaveAllowedComputations(vault.id, selectedComputationIds)
                    }
                  >
                    {isSavingAllowed ? 'Saving...' : 'Save Allowed Computations'}
                  </Button>
                  <Button
                    variant="text"
                    disabled={isSaving || !hasUnsavedAllowedComputationChanges}
                    onClick={() => {
                      setSelectedComputationIds(
                        allowedComputations.map((computation) => computation.id),
                      )
                      setSelectedDatasetMappings(
                        toDatasetMappingRecord(persistedDatasetMappings),
                      )
                    }}
                  >
                    Reset
                  </Button>
                </Box>
              </Box>

              <Box>
                <Box
                  sx={{
                    alignItems: 'center',
                    display: 'flex',
                    gap: 1,
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2">
                    Dataset Inventory
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={`${availableDatasets.length} available`}
                      size="small"
                      color={availableDatasets.length > 0 ? 'success' : 'default'}
                      variant="outlined"
                    />
                    <Chip
                      label={`${mappedDatasetCount}/${allowedComputations.length} mapped`}
                      size="small"
                      color={mappedDatasetCount > 0 ? 'primary' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                </Box>

                {availableDatasets.length > 0 ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Dataset Key</TableCell>
                        <TableCell>Path</TableCell>
                        <TableCell>Last Seen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableDatasets.map((dataset) => (
                        <TableRow key={dataset.key}>
                          <TableCell>{dataset.label || dataset.key}</TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                            >
                              {dataset.path}
                            </Typography>
                          </TableCell>
                          <TableCell>{formatLastSeen(dataset.lastSeenAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert severity="warning">
                    This vault has not reported any dataset directories yet.
                  </Alert>
                )}
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Computation Dataset Mapping
                </Typography>
                {hasUnsavedAllowedComputationChanges && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Save allowed computations before changing dataset mappings.
                  </Alert>
                )}
                {allowedComputations.length > 0 ? (
                  <Box sx={{ display: 'grid', gap: 1.5 }}>
                    {allowedComputations.map((computation) => {
                      const selectedDatasetKey =
                        selectedDatasetMappings[computation.id] ?? ''
                      const selectedDataset = availableDatasets.find(
                        (dataset) => dataset.key === selectedDatasetKey,
                      )

                      return (
                        <Paper
                          key={computation.id}
                          sx={{ p: 2 }}
                          variant="outlined"
                        >
                          <Box
                            sx={{
                              display: 'grid',
                              gap: 1.5,
                              gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 320px)',
                            }}
                          >
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {computation.title}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {computation.imageName}
                              </Typography>
                            </Box>
                            <FormControl
                              disabled={hasUnsavedAllowedComputationChanges || isSaving}
                              fullWidth
                              size="small"
                            >
                              <InputLabel id={`dataset-mapping-${vault.id}-${computation.id}`}>
                                Dataset
                              </InputLabel>
                              <Select
                                label="Dataset"
                                labelId={`dataset-mapping-${vault.id}-${computation.id}`}
                                onChange={(event) =>
                                  handleDatasetMappingChange(computation.id, event)
                                }
                                value={selectedDatasetKey}
                              >
                                <MenuItem value="">
                                  <em>Unmapped</em>
                                </MenuItem>
                                {availableDatasets.map((dataset) => (
                                  <MenuItem key={dataset.key} value={dataset.key}>
                                    {dataset.label || dataset.key}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Box>
                          <Typography
                            color="text.secondary"
                            sx={{ mt: 1 }}
                            variant="caption"
                          >
                            {selectedDataset
                              ? `Path: ${selectedDataset.path}`
                              : 'No dataset mapped for this computation'}
                          </Typography>
                        </Paper>
                      )
                    })}
                  </Box>
                ) : (
                  <Typography color="text.secondary">
                    No allowed computations selected for this vault.
                  </Typography>
                )}
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    disabled={
                      isSaving ||
                      hasUnsavedAllowedComputationChanges ||
                      !hasUnsavedDatasetMappingChanges
                    }
                    onClick={() =>
                      onSaveDatasetMappings(
                        vault.id,
                        allowedComputations
                          .map((computation) => ({
                            computationId: computation.id,
                            datasetKey:
                              selectedDatasetMappings[computation.id] ?? '',
                          }))
                          .filter((mapping) => mapping.datasetKey.length > 0),
                      )
                    }
                  >
                    {isSavingDatasetMappings ? 'Saving...' : 'Save Dataset Mappings'}
                  </Button>
                  <Button
                    variant="text"
                    disabled={
                      isSaving ||
                      hasUnsavedAllowedComputationChanges ||
                      !hasUnsavedDatasetMappingChanges
                    }
                    onClick={() =>
                      setSelectedDatasetMappings(
                        toDatasetMappingRecord(persistedDatasetMappings),
                      )
                    }
                  >
                    Reset
                  </Button>
                </Box>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Running Computations
                </Typography>
                {hasRunningComputations ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Consortium</TableCell>
                        <TableCell>Run ID</TableCell>
                        <TableCell>Running For</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {status!.runningComputations.map((computation) => (
                        <TableRow key={computation.runId}>
                          <TableCell>
                            {computation.consortiumTitle || computation.consortiumId}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                            >
                              {computation.runId.substring(0, 8)}...
                            </Typography>
                          </TableCell>
                          <TableCell>{formatUptime(computation.runningFor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography color="text.secondary">No active computations</Typography>
                )}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default function VaultStatus() {
  const {
    adminSetVaultAllowedComputations,
    adminSetVaultDatasetMappings,
    getComputationList,
    getVaultUserList,
  } = useCentralApi()
  const [vaults, setVaults] = useState<PublicUser[]>([])
  const [computations, setComputations] = useState<ComputationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [savingVaultId, setSavingVaultId] = useState<string | null>(null)
  const [savingAction, setSavingAction] = useState<'allowed' | 'datasetMappings' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadVaults = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [vaultResponse, computationResponse] = await Promise.all([
        getVaultUserList(),
        getComputationList(),
      ])
      setVaults(vaultResponse)
      setComputations(computationResponse)
      setLastRefresh(new Date())
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch vault status'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [getComputationList, getVaultUserList])

  useEffect(() => {
    loadVaults()
    const interval = setInterval(loadVaults, 30000)
    return () => clearInterval(interval)
  }, [loadVaults])

  const handleSaveAllowedComputations = useCallback(
    async (vaultId: string, computationIds: string[]) => {
      try {
        setSavingVaultId(vaultId)
        setSavingAction('allowed')
        setSaveError(null)
        await adminSetVaultAllowedComputations({ userId: vaultId, computationIds })
        await loadVaults()
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : 'Failed to save allowed computations',
        )
      } finally {
        setSavingVaultId(null)
        setSavingAction(null)
      }
    },
    [adminSetVaultAllowedComputations, loadVaults],
  )

  const handleSaveDatasetMappings = useCallback(
    async (vaultId: string, mappings: VaultDatasetMappingInput[]) => {
      try {
        setSavingVaultId(vaultId)
        setSavingAction('datasetMappings')
        setSaveError(null)
        await adminSetVaultDatasetMappings({ userId: vaultId, mappings })
        await loadVaults()
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : 'Failed to save dataset mappings',
        )
      } finally {
        setSavingVaultId(null)
        setSavingAction(null)
      }
    },
    [adminSetVaultDatasetMappings, loadVaults],
  )

  const onlineCount = vaults.filter(
    (vault) => vault.vaultStatus && isOnline(vault.vaultStatus.lastHeartbeat),
  ).length
  const offlineCount = vaults.length - onlineCount

  if (loading && vaults.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={loadVaults}>
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            icon={<CheckCircleIcon />}
            label={`${onlineCount} Online`}
            color="success"
            variant="outlined"
          />
          {offlineCount > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${offlineCount} Offline`}
              color="error"
              variant="outlined"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
          <IconButton onClick={loadVaults} disabled={loading} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {vaults.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No vault users found
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell />
                <TableCell>Vault</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Uptime</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell>Allowed</TableCell>
                <TableCell>Running</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vaults.map((vault) => (
                <VaultRow
                  key={vault.id}
                  allComputations={computations}
                  onSaveAllowedComputations={handleSaveAllowedComputations}
                  onSaveDatasetMappings={handleSaveDatasetMappings}
                  saveError={savingVaultId === vault.id ? saveError : null}
                  savingAction={savingVaultId === vault.id ? savingAction : null}
                  savingVaultId={savingVaultId}
                  vault={vault}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
