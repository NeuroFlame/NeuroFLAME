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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            width: '50%',
            borderRight: '1px solid grey',
            padding: '0 1rem 1rem 0',
            overflow: 'scroll',
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
                        }}
                        secondaryAction={
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              marginRight: '-1rem',
                              flex: '0.25',
                            }}
                          >
                            <Button
                              variant='outlined'
                              color='primary'
                              size='small'
                              onClick={() => setSelectedVaultInfo(index)}
                            >
                              Info
                            </Button>
                            <Button
                              variant='contained'
                              color='primary'
                              size='small'
                              disabled={addDisabled}
                              onClick={() => handleAdd(id)}
                            >
                              {alreadyMember ? 'Added' : 'Add'}
                            </Button>
                            {!allowsSelectedComputation && (
                              <Typography variant='caption' color='error'>
                                Not allowed for current computation
                              </Typography>
                            )}
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={vaultUser.name}
                          secondary={vaultUser.datasetKey}
                          primaryTypographyProps={{ fontWeight: 'bold' }}
                          sx={{ flex: '0.75' }}
                        />
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
            width: '50%',
            padding: '0 1rem 1rem 1rem',
            height: 'calc(380px - 4rem)',
            overflow: 'scroll',
          }}
        >
          <h4 style={{ color: 'black' }}>
            {vaultUserList[selectedVaultInfo]?.datasetKey}
          </h4>
          <h2 style={{ lineHeight: 1.2 }}>{vaultUserList[selectedVaultInfo]?.name}</h2>
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
          <ReactMarkdown
            className='markdown-wrapper'
            components={markdownComponents}
            remarkPlugins={[remarkGfm]}
          >
            {vaultUserList[selectedVaultInfo]?.description ?? ''}
          </ReactMarkdown>
        </Box>
      </Box>
    </>
  )
}

export default VaultUserList
