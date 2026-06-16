import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  TextField,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import {
  ComputationListItem,
  HostedVault,
  LoginOutput,
  VaultServer,
} from '../../apis/centralApi/generated/graphql'
import { createMarkdownComponents } from '../../utils/markdownComponents'

const OFFLINE_THRESHOLD_MS = 90_000
const DESCRIPTION_PREVIEW_HEIGHT = 160

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

function MarkdownDescription({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false)
  const markdownComponents = useMemo(() => createMarkdownComponents(), [])
  const markdown = value.trim()
  const shouldCollapse = markdown.length > 700 || markdown.split('\n').length > 8

  return (
    <Box sx={{ mt: 1 }}>
      <Box
        className="markdown-wrapper"
        sx={{
          color: 'text.secondary',
          fontSize: '0.9rem',
          lineHeight: 1.5,
          maxHeight: expanded || !shouldCollapse ? 'none' : DESCRIPTION_PREVIEW_HEIGHT,
          overflow: 'hidden',
          position: 'relative',
          '& h1, & h2, & h3, & h4, & h5, & h6': {
            color: 'text.primary',
            fontWeight: 600,
            lineHeight: 1.25,
            mt: 1.5,
            mb: 0.75,
          },
          '& h1': { fontSize: '1.25rem' },
          '& h2': { fontSize: '1.1rem' },
          '& h3': { fontSize: '1rem' },
          '& h4, & h5, & h6': { fontSize: '0.95rem' },
          '& p': {
            color: 'text.secondary',
            fontSize: '0.9rem',
            fontWeight: 400,
            mb: 0.75,
          },
          '& strong, & b': {
            color: 'text.primary',
            fontWeight: 600,
          },
          '& code': {
            fontSize: '0.85rem',
            fontWeight: 500,
            whiteSpace: 'normal',
          },
          '& ul, & ol': {
            pl: 2,
            ml: 0,
          },
          '& .table-wrapper': {
            maxWidth: '100%',
            overflowX: 'auto',
          },
          '& table': {
            fontSize: '0.85rem',
          },
        }}
      >
        <ReactMarkdown
          components={markdownComponents}
          remarkPlugins={[remarkGfm]}
        >
          {markdown}
        </ReactMarkdown>
      </Box>
      {shouldCollapse && (
        <Button
          variant="text"
          size="small"
          onClick={() => setExpanded((current) => !current)}
          sx={{ mt: 0.5, px: 0 }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </Box>
  )
}

interface VaultUserProvisionerProps {
  createdVaultUser: LoginOutput | null
  createError: string | null
  creatingVaultUser: boolean
  onCreateVaultUser: (input: { username: string; password: string }) => Promise<void>
}

function VaultUserProvisioner({
  createdVaultUser,
  createError,
  creatingVaultUser,
  onCreateVaultUser,
}: VaultUserProvisionerProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCreateVaultUser = async () => {
    await onCreateVaultUser({
      username,
      password,
    })
    setPassword('')
    setCopySuccess(false)
  }

  const handleCopyToken = async () => {
    if (!createdVaultUser?.accessToken) return

    await navigator.clipboard.writeText(createdVaultUser.accessToken)
    setCopySuccess(true)
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Create Vault User
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Creates a vault service account and returns the token for VAULT_ACCESS_TOKEN.
      </Typography>

      {createError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {createError}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'minmax(240px, 1fr) minmax(200px, 320px) auto' }}>
        <TextField
          fullWidth
          size="small"
          label="Vault User Email"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={creatingVaultUser}
        />
        <TextField
          fullWidth
          size="small"
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={creatingVaultUser}
        />
        <Button
          variant="contained"
          disabled={creatingVaultUser || username.trim().length === 0 || password.length === 0}
          onClick={handleCreateVaultUser}
        >
          {creatingVaultUser ? 'Creating...' : 'Create User'}
        </Button>
      </Box>

      {createdVaultUser && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="success" sx={{ mb: 1.5 }}>
            Vault user {createdVaultUser.username} created. Use this token as VAULT_ACCESS_TOKEN.
          </Alert>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="VAULT_ACCESS_TOKEN"
            value={createdVaultUser.accessToken}
            InputProps={{ readOnly: true }}
          />
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyToken}
            sx={{ mt: 1 }}
          >
            {copySuccess ? 'Copied' : 'Copy Token'}
          </Button>
        </Box>
      )}
    </Paper>
  )
}

interface HostedVaultCardProps {
  allComputations: ComputationListItem[]
  hostedVault: HostedVault
  saveError: string | null
  savingVaultId: string | null
  onUpdateHostedVault: (
    vaultId: string,
    input: { name: string; description: string },
  ) => Promise<void>
  onSaveAllowedComputations: (
    vaultId: string,
    computationIds: string[],
  ) => Promise<void>
}

function HostedVaultCard({
  allComputations,
  hostedVault,
  saveError,
  savingVaultId,
  onUpdateHostedVault,
  onSaveAllowedComputations,
}: HostedVaultCardProps) {
  const [selectedComputationIds, setSelectedComputationIds] = useState<string[]>(
    hostedVault.allowedComputations.map((computation) => computation.id),
  )
  const [editingDetails, setEditingDetails] = useState(false)
  const [editName, setEditName] = useState(hostedVault.name)
  const [editDescription, setEditDescription] = useState(hostedVault.description)

  useEffect(() => {
    setSelectedComputationIds(
      hostedVault.allowedComputations.map((computation) => computation.id),
    )
  }, [hostedVault.allowedComputations])

  useEffect(() => {
    setEditName(hostedVault.name)
    setEditDescription(hostedVault.description)
  }, [hostedVault.description, hostedVault.name])

  const isSaving = savingVaultId === hostedVault.id
  const hasUnsavedChanges =
    selectedComputationIds.length !== hostedVault.allowedComputations.length ||
    selectedComputationIds.some(
      (id) => !hostedVault.allowedComputations.some((computation) => computation.id === id),
    )

  const toggleComputation = (computationId: string) => {
    setSelectedComputationIds((currentIds) => {
      if (currentIds.includes(computationId)) {
        return currentIds.filter((id) => id !== computationId)
      }

      return [...currentIds, computationId]
    })
  }

  const hasUnsavedDetails =
    editName !== hostedVault.name ||
    editDescription !== hostedVault.description

  const handleCancelDetailsEdit = () => {
    setEditName(hostedVault.name)
    setEditDescription(hostedVault.description)
    setEditingDetails(false)
  }

  const handleSaveDetails = async () => {
    try {
      await onUpdateHostedVault(hostedVault.id, {
        name: editName,
        description: editDescription,
      })
      setEditingDetails(false)
    } catch {
      // Keep edit mode open so the admin can fix the input and retry.
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        sx={{
          alignItems: 'flex-start',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          mb: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
            {hostedVault.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Dataset: {hostedVault.datasetKey}
          </Typography>
        </Box>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            flexShrink: 0,
            gap: 1,
          }}
        >
          <Chip
            label={hostedVault.active ? 'Active' : 'Inactive'}
            size="small"
            color={hostedVault.active ? 'success' : 'default'}
            variant="outlined"
          />
          {!editingDetails && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setEditingDetails(true)}
            >
              Edit Details
            </Button>
          )}
        </Box>
      </Box>

      {editingDetails ? (
        <Box sx={{ display: 'grid', gap: 1.25, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Vault Name"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            disabled={isSaving}
          />
          <TextField
            fullWidth
            multiline
            minRows={8}
            label="Description Markdown"
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            disabled={isSaving}
            helperText="Stored as markdown exactly as entered."
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              disabled={isSaving || editName.trim().length === 0 || !hasUnsavedDetails}
              onClick={handleSaveDetails}
            >
              {isSaving ? 'Saving...' : 'Save Details'}
            </Button>
            <Button
              variant="text"
              size="small"
              disabled={isSaving}
              onClick={handleCancelDetailsEdit}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      ) : (
        hostedVault.description && <MarkdownDescription value={hostedVault.description} />
      )}

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
          disabled={isSaving || !hasUnsavedChanges}
          onClick={() => onSaveAllowedComputations(hostedVault.id, selectedComputationIds)}
        >
          {isSaving ? 'Saving...' : 'Save Allowed Computations'}
        </Button>
        <Button
          variant="text"
          disabled={isSaving || !hasUnsavedChanges}
          onClick={() =>
            setSelectedComputationIds(
              hostedVault.allowedComputations.map((computation) => computation.id),
            )
          }
        >
          Reset
        </Button>
      </Box>
    </Paper>
  )
}

interface VaultServerRowProps {
  allComputations: ComputationListItem[]
  creatingServerId: string | null
  saveError: string | null
  savingVaultId: string | null
  server: VaultServer
  onCreateHostedVault: (
    serverId: string,
    input: { datasetKey: string; name: string; description: string },
  ) => Promise<void>
  onUpdateHostedVault: (
    vaultId: string,
    input: { name: string; description: string },
  ) => Promise<void>
  onSaveAllowedComputations: (
    vaultId: string,
    computationIds: string[],
  ) => Promise<void>
}

function VaultServerRow({
  allComputations,
  creatingServerId,
  saveError,
  savingVaultId,
  server,
  onCreateHostedVault,
  onUpdateHostedVault,
  onSaveAllowedComputations,
}: VaultServerRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [newVaultDatasetKey, setNewVaultDatasetKey] = useState('')
  const [newVaultName, setNewVaultName] = useState('')
  const [newVaultDescription, setNewVaultDescription] = useState('')

  const status = server.status
  const online = status ? isOnline(status.lastHeartbeat) : false
  const hasRunningComputations = (status?.runningComputations?.length ?? 0) > 0
  const assignedDatasetKeys = useMemo(
    () => new Set(server.vaults.map((hostedVault) => hostedVault.datasetKey)),
    [server.vaults],
  )
  const availableDatasets = status?.availableDatasets ?? []
  const unassignedDatasets = availableDatasets.filter(
    (dataset) => !assignedDatasetKeys.has(dataset.key),
  )
  const isCreating = creatingServerId === server.id

  useEffect(() => {
    if (unassignedDatasets.length === 0) {
      setNewVaultDatasetKey('')
      return
    }

    const selectedDatasetStillExists = unassignedDatasets.some(
      (dataset) => dataset.key === newVaultDatasetKey,
    )

    if (!selectedDatasetStillExists) {
      setNewVaultDatasetKey(unassignedDatasets[0].key)
    }
  }, [newVaultDatasetKey, unassignedDatasets])

  const handleCreateVault = async () => {
    await onCreateHostedVault(server.id, {
      datasetKey: newVaultDatasetKey,
      name: newVaultName,
      description: newVaultDescription,
    })
    setNewVaultName('')
    setNewVaultDescription('')
  }

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
              <CheckCircleIcon color='success' fontSize='small' />
            ) : (
              <ErrorIcon color='error' fontSize='small' />
            )}
            <Typography fontWeight="medium">
              {server.name}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {server.username}
          </Typography>
        </TableCell>
        <TableCell>
          {online ? (
            <Chip label='Online' size='small' color='success' />
          ) : (
            <Chip label='Offline' size='small' color='error' />
          )}
        </TableCell>
        <TableCell>{status?.version || '-'}</TableCell>
        <TableCell>{status ? formatUptime(status.uptime) : '-'}</TableCell>
        <TableCell>
          {status ? formatLastSeen(status.lastHeartbeat) : 'Never'}
        </TableCell>
        <TableCell>
          <Chip label={`${server.vaults.length} vaults`} size="small" color={server.vaults.length > 0 ? 'primary' : 'default'} variant="outlined" />
        </TableCell>
        <TableCell>
          {hasRunningComputations ? (
            <Chip
              label={`${status!.runningComputations.length} running`}
              size="small"
              color="primary"
            />
          ) : (
            <Typography color='text.secondary'>None</Typography>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2, display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Server
                </Typography>
                <Typography variant="body2">{server.description || 'No description'}</Typography>
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
                      label={`${server.vaults.length}/${availableDatasets.length} hosted`}
                      size="small"
                      color={server.vaults.length > 0 ? 'primary' : 'default'}
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
                        <TableCell>Hosted Vault</TableCell>
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
                          <TableCell>
                            {server.vaults.find((hostedVault) => hostedVault.datasetKey === dataset.key)?.name || (
                              <Typography color="text.secondary">Unassigned</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert severity="warning">
                    This server has not reported any dataset directories yet.
                  </Alert>
                )}
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Hosted Vaults
                </Typography>
                {server.vaults.length > 0 ? (
                  <Box sx={{ display: 'grid', gap: 1.5 }}>
                    {server.vaults.map((hostedVault) => (
                      <HostedVaultCard
                        key={hostedVault.id}
                        allComputations={allComputations}
                        hostedVault={hostedVault}
                        onUpdateHostedVault={onUpdateHostedVault}
                        onSaveAllowedComputations={onSaveAllowedComputations}
                        saveError={savingVaultId === hostedVault.id ? saveError : null}
                        savingVaultId={savingVaultId}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography color="text.secondary">
                    No hosted vaults created for this server yet.
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Create Hosted Vault
                </Typography>
                {saveError && creatingServerId === server.id && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {saveError}
                  </Alert>
                )}
                {unassignedDatasets.length > 0 ? (
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'minmax(220px, 280px) minmax(220px, 1fr) auto' }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`dataset-select-${server.id}`}>Dataset</InputLabel>
                      <Select
                        label="Dataset"
                        labelId={`dataset-select-${server.id}`}
                        value={newVaultDatasetKey}
                        onChange={(event: SelectChangeEvent<string>) => setNewVaultDatasetKey(event.target.value)}
                      >
                        {unassignedDatasets.map((dataset) => (
                          <MenuItem key={dataset.key} value={dataset.key}>
                            {dataset.label || dataset.key}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth
                      size="small"
                      label="Vault Name"
                      value={newVaultName}
                      onChange={(event) => setNewVaultName(event.target.value)}
                    />
                    <Button
                      variant="contained"
                      disabled={isCreating || newVaultDatasetKey.length === 0}
                      onClick={handleCreateVault}
                      sx={{ alignSelf: 'start' }}
                    >
                      {isCreating ? 'Creating...' : 'Create Vault'}
                    </Button>
                    <TextField
                      fullWidth
                      multiline
                      minRows={8}
                      label="Description Markdown"
                      placeholder="Paste markdown here. Tables need real line breaks."
                      value={newVaultDescription}
                      onChange={(event) => setNewVaultDescription(event.target.value)}
                      sx={{ gridColumn: '1 / -1' }}
                      helperText="Stored as markdown exactly as entered."
                    />
                  </Box>
                ) : (
                  <Typography color="text.secondary">
                    Every reported dataset on this server already has a hosted vault.
                  </Typography>
                )}
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
    adminCreateVaultUser,
    adminCreateHostedVault,
    adminSetHostedVaultAllowedComputations,
    adminUpdateHostedVault,
    getComputationList,
    getVaultServerList,
  } = useCentralApi()
  const [vaultServers, setVaultServers] = useState<VaultServer[]>([])
  const [computations, setComputations] = useState<ComputationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [savingVaultId, setSavingVaultId] = useState<string | null>(null)
  const [creatingServerId, setCreatingServerId] = useState<string | null>(null)
  const [creatingVaultUser, setCreatingVaultUser] = useState(false)
  const [createdVaultUser, setCreatedVaultUser] = useState<LoginOutput | null>(null)
  const [createVaultUserError, setCreateVaultUserError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadVaults = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [serverResponse, computationResponse] = await Promise.all([
        getVaultServerList(),
        getComputationList(),
      ])
      setVaultServers(serverResponse)
      setComputations(computationResponse)
      setLastRefresh(new Date())
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch vault status'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [getComputationList, getVaultServerList])

  useEffect(() => {
    loadVaults()
    const interval = setInterval(loadVaults, 30000)
    return () => clearInterval(interval)
  }, [loadVaults])

  const handleSaveAllowedComputations = useCallback(
    async (vaultId: string, computationIds: string[]) => {
      try {
        setSavingVaultId(vaultId)
        setSaveError(null)
        await adminSetHostedVaultAllowedComputations({ vaultId, computationIds })
        await loadVaults()
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : 'Failed to save allowed computations',
        )
      } finally {
        setSavingVaultId(null)
      }
    },
    [adminSetHostedVaultAllowedComputations, loadVaults],
  )

  const handleCreateHostedVault = useCallback(
    async (
      serverId: string,
      {
        datasetKey,
        description,
        name,
      }: { datasetKey: string; name: string; description: string },
    ) => {
      try {
        setCreatingServerId(serverId)
        setSaveError(null)
        await adminCreateHostedVault({
          serverId,
          datasetKey,
          name: name.trim().length > 0 ? name.trim() : datasetKey,
          description: description.trim(),
        })
        await loadVaults()
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : 'Failed to create hosted vault',
        )
      } finally {
        setCreatingServerId(null)
      }
    },
    [adminCreateHostedVault, loadVaults],
  )

  const handleUpdateHostedVault = useCallback(
    async (
      vaultId: string,
      {
        description,
        name,
      }: { name: string; description: string },
    ) => {
      try {
        setSavingVaultId(vaultId)
        setSaveError(null)
        await adminUpdateHostedVault({
          vaultId,
          name: name.trim(),
          description: description.trim(),
        })
        await loadVaults()
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : 'Failed to update hosted vault',
        )
        throw err
      } finally {
        setSavingVaultId(null)
      }
    },
    [adminUpdateHostedVault, loadVaults],
  )

  const handleCreateVaultUser = useCallback(
    async ({ username, password }: { username: string; password: string }) => {
      try {
        setCreatingVaultUser(true)
        setCreateVaultUserError(null)
        const vaultUser = await adminCreateVaultUser({
          username: username.trim(),
          password,
        })
        setCreatedVaultUser(vaultUser)
        await loadVaults()
      } catch (err) {
        setCreateVaultUserError(
          err instanceof Error
            ? err.message
            : 'Failed to create vault user',
        )
      } finally {
        setCreatingVaultUser(false)
      }
    },
    [adminCreateVaultUser, loadVaults],
  )

  const onlineCount = vaultServers.filter(
    (server) => server.status && isOnline(server.status.lastHeartbeat),
  ).length
  const offlineCount = vaultServers.length - onlineCount

  if (loading && vaultServers.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity='error' sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant='contained' onClick={loadVaults}>
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <VaultUserProvisioner
        createdVaultUser={createdVaultUser}
        createError={createVaultUserError}
        creatingVaultUser={creatingVaultUser}
        onCreateVaultUser={handleCreateVaultUser}
      />

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
            color='success'
            variant='outlined'
          />
          {offlineCount > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${offlineCount} Offline`}
              color='error'
              variant='outlined'
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant='caption' color='text.secondary'>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
          <IconButton onClick={loadVaults} disabled={loading} size='small'>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {vaultServers.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No vault servers found
        </Typography>
      ) : (
        <TableContainer component={Paper} variant='outlined'>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell />
                <TableCell>Vault</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Uptime</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell>Hosted Vaults</TableCell>
                <TableCell>Running</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vaultServers.map((server) => (
                <VaultServerRow
                  key={server.id}
                  allComputations={computations}
                  creatingServerId={creatingServerId}
                  onCreateHostedVault={handleCreateHostedVault}
                  onUpdateHostedVault={handleUpdateHostedVault}
                  onSaveAllowedComputations={handleSaveAllowedComputations}
                  saveError={saveError}
                  savingVaultId={savingVaultId}
                  server={server}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
