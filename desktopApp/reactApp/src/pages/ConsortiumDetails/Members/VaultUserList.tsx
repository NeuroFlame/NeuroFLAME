// VaultUserList.tsx

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { HostedVault } from '../../../apis/centralApi/generated/graphql'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  List,
  ListItem,
  ListItemText,
  Button,
  Divider,
  Box,
  CircularProgress,
  Alert,
  Typography,
  Chip,
} from '@mui/material'
import { createMarkdownComponents } from '../../../utils/markdownComponents'
import { useConsortiumDetailsContext } from '../ConsortiumDetailsContext'

interface VaultUserListProps {
  onClose: () => void;
}

const VaultUserList: React.FC<VaultUserListProps> = ({ onClose }) => {
  const { getHostedVaultList, leaderAddHostedVault } = useCentralApi()
  const [vaultUserList, setVaultUserList] = useState<HostedVault[]>([])
  const [selectedVaultInfo, setSelectedVaultInfo] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string
  const {
    data: { members, studyConfiguration },
  } = useConsortiumDetailsContext()

  // React-Markdown custom renderers
  const markdownComponents = useMemo(() => createMarkdownComponents(), [])
  const selectedComputation = studyConfiguration?.computation

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getHostedVaultList({})
      setVaultUserList(res)
      setSelectedVaultInfo((prev) =>
        res.length === 0 ? 0 : Math.min(prev, res.length - 1),
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch vault users'
      setError(errorMessage)
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleAdd = async (vaultId: string) => {
    try {
      await leaderAddHostedVault({ consortiumId, vaultId })
      onClose()
    } catch (error) {
      console.error('Error adding user:', error)
    }
  }

  const existingMemberIds = useMemo(
    () => new Set(members.map((member) => member.id)),
    [members],
  )

  const vaultCompatibility = useMemo(
    () =>
      vaultUserList.map((vaultUser) => {
        const allowsSelectedComputation =
          !selectedComputation ||
          (vaultUser.allowedComputations ?? []).some(
            (computation) => computation.imageName === selectedComputation.imageName,
          )

        return {
          vaultUser,
          alreadyMember: existingMemberIds.has(vaultUser.id),
          allowsSelectedComputation,
        }
      }),
    [existingMemberIds, selectedComputation, vaultUserList],
  )

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 'calc(380px - 4rem)',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity='error' sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant='contained' onClick={loadUsers}>
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'flex-start',
        }}
      >
        <Box
          sx={{
            flex: '0 0 48%',
            borderRight: '1px solid grey',
            padding: '0 1rem 1rem 0',
            overflow: 'auto',
            height: 'calc(380px - 4rem)',
          }}
        >
          {selectedComputation && (
            <Alert severity='info' sx={{ mb: 2 }}>
              Current computation: {selectedComputation.title}. Only vaults that
              allow it can be added.
            </Alert>
          )}
          {vaultUserList.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant='body1' color='text.secondary'>
                No vault users found
              </Typography>
            </Box>
          ) : (
            <List>
              {vaultCompatibility.map(
                ({ vaultUser, alreadyMember, allowsSelectedComputation }, index) => {
                  const { id } = vaultUser
                  const addDisabled = alreadyMember || !allowsSelectedComputation

                  return (
                    <React.Fragment key={id}>
                      <ListItem
                        sx={{
                          padding: '1rem 0',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 2,
                        }}
                      >
                        <ListItemText
                          primary={vaultUser.name}
                          secondary={vaultUser.datasetKey}
                          primaryTypographyProps={{
                            fontWeight: 'bold',
                            sx: {
                              overflowWrap: 'anywhere',
                              pr: 1,
                            },
                          }}
                          secondaryTypographyProps={{
                            sx: {
                              overflowWrap: 'anywhere',
                              pr: 1,
                            },
                          }}
                          sx={{ flex: '1 1 auto', minWidth: 0, my: 0 }}
                        />
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            flex: '0 0 128px',
                            alignItems: 'stretch',
                          }}
                        >
                          <Button
                            variant='outlined'
                            color='primary'
                            size='small'
                            onClick={() => setSelectedVaultInfo(index)}
                            sx={{ minWidth: 0 }}
                          >
                            Info
                          </Button>
                          <Button
                            variant='contained'
                            color='primary'
                            size='small'
                            disabled={addDisabled}
                            onClick={() => handleAdd(id)}
                            sx={{ minWidth: 0 }}
                          >
                            {alreadyMember ? 'Added' : 'Add'}
                          </Button>
                          {!allowsSelectedComputation && (
                            <Typography
                              variant='caption'
                              color='error'
                              sx={{
                                lineHeight: 1.2,
                                overflowWrap: 'anywhere',
                                textAlign: 'center',
                              }}
                            >
                              Not allowed for current computation
                            </Typography>
                          )}
                        </Box>
                      </ListItem>
                      <Divider component='li' />
                    </React.Fragment>
                  )
                },
              )}
            </List>
          )}
        </Box>
        <Box
          sx={{
            flex: '1 1 52%',
            padding: '0 1rem 1rem 1rem',
            height: 'calc(380px - 4rem)',
            overflow: 'auto',
          }}
        >
          <Typography
            variant='subtitle2'
            sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}
          >
            {vaultUserList[selectedVaultInfo]?.datasetKey}
          </Typography>
          <Typography
            variant='h4'
            sx={{
              color: 'primary.main',
              lineHeight: 1.15,
              mb: 2,
              overflowWrap: 'anywhere',
            }}
          >
            {vaultUserList[selectedVaultInfo]?.name}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              marginBottom: '1rem',
            }}
          >
            {(vaultUserList[selectedVaultInfo]?.allowedComputations ?? []).length ? (
              (vaultUserList[selectedVaultInfo]?.allowedComputations ?? []).map((computation) => (
                <Chip
                  key={computation.id}
                  label={computation.title}
                  size='small'
                  color={
                    selectedComputation?.imageName === computation.imageName
                      ? 'primary'
                      : 'default'
                  }
                  variant={
                    selectedComputation?.imageName === computation.imageName
                      ? 'filled'
                      : 'outlined'
                  }
                />
              ))
            ) : (
              <Typography variant='body2' color='text.secondary'>
                No allowed computations configured
              </Typography>
            )}
          </Box>
          <Box
            className='markdown-wrapper'
            sx={{
              color: 'text.primary',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              overflowWrap: 'anywhere',
              '& h1, & h2, & h3, & h4, & h5, & h6': {
                color: 'text.primary',
                fontWeight: 600,
                lineHeight: 1.25,
                mt: 2,
                mb: 1,
              },
              '& h1': { fontSize: '1.5rem' },
              '& h2': { fontSize: '1.3rem' },
              '& h3': { fontSize: '1.1rem' },
              '& p': {
                color: 'text.primary',
                fontSize: '0.95rem',
                mb: 1,
              },
              '& a': {
                color: 'primary.main',
              },
              '& ul, & ol': {
                pl: 2,
                ml: 0,
              },
            }}
          >
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {vaultUserList[selectedVaultInfo]?.description ?? ''}
            </ReactMarkdown>
          </Box>
        </Box>
      </Box>
    </>
  )
}

export default VaultUserList
