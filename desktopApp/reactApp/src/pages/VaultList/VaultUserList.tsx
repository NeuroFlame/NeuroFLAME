// VaultUserList.tsx

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { PublicUser } from '../../apis/centralApi/generated/graphql'
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
} from '@mui/material'
import { createMarkdownComponents } from '../../utils/markdownComponents'

interface VaultUserListProps {
  refreshSignal: number
}

const VaultUserList: React.FC<VaultUserListProps> = ({ refreshSignal }) => {
  const { getVaultUserList, leaderAddVaultUser } = useCentralApi()
  const [vaultUserList, setVaultUserList] = useState<PublicUser[]>([])
  const [selectedVaultInfo, setSelectedVaultInfo] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  // Note: consortiumId would need to be passed as a prop or selected from context for handleAdd to work
  const consortiumId = useParams<{ consortiumId: string }>()
    .consortiumId as string

  const markdownComponents = useMemo(() => createMarkdownComponents(), [])

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getVaultUserList()
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
  }, [refreshSignal, loadUsers])

  // Example usage of handleAdd if you surface an "Add" button
  // Note: This would require consortiumId to be passed as a prop or selected from context
  const handleAdd = async (userId: string) => {
    try {
      await leaderAddVaultUser({ consortiumId, userId })
      // Automatically refresh list after adding
      await loadUsers()
    } catch (error) {
      console.error('Error adding user:', error)
    }
  }

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '70vh',
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
          height: '70vh',
        }}
      >
        {vaultUserList.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant='body1' color='text.secondary'>
              No vault users found
            </Typography>
          </Box>
        ) : (
          <List>
            {vaultUserList.map(({ id, username, vault }, index) => (
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
                      flex: '0.2',
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

                    {/* Example usage of handleAdd if you surface an "Add" button */}
                    {/* <Button
                      variant='contained'
                      color='primary'
                      size='small'
                      onClick={() => handleAdd(id)}
                    >
                      Add
                    </Button> */}
                  </Box>
                }
              >
                <ListItemText
                  primary={vault?.name || 'No Vault Assigned'}
                  secondary={username}
                  primaryTypographyProps={{
                    fontWeight: 'bold',
                    fontSize: '1.5rem',
                    lineHeight: 1,
                  }}
                  sx={{ flex: '0.80' }}
                />
              </ListItem>
              <Divider component='li' />
            </React.Fragment>
          ))}
          </List>
        )}
      </Box>
      <Box
        sx={{
          width: '50%',
          padding: '0 1rem 1rem 1rem',
          overflow: 'scroll',
          height: '70vh',
        }}
      >
        <h4 style={{ color: 'black' }}>
          {vaultUserList[selectedVaultInfo]?.username}
        </h4>
        <h2 style={{ lineHeight: 1.2 }}>{vaultUserList[selectedVaultInfo]?.vault?.name}</h2>
        <ReactMarkdown
          className='markdown-wrapper'
          components={markdownComponents}
          remarkPlugins={[remarkGfm]}
        >
          {vaultUserList[selectedVaultInfo]?.vault?.description ?? ''}
        </ReactMarkdown>
      </Box>
    </Box>
  )
}

export default VaultUserList
