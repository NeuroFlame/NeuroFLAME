// VaultUserList.tsx

import React, { useEffect, useState, useMemo } from 'react'
import { useCentralApi } from '../../../apis/centralApi/centralApi'
import { PublicUser } from '../../../apis/centralApi/generated/graphql'
import { useParams } from 'react-router-dom'
import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  List,
  ListItem,
  ListItemText,
  Button,
  Divider,
  Box,
} from '@mui/material'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')

interface VaultUserListProps {
  onClose: () => void;
}

const VaultUserList: React.FC<VaultUserListProps> = ({ onClose }) => {
  const { getVaultUserList, leaderAddVaultUser } = useCentralApi()
  const [vaultUserList, setVaultUserList] = useState<PublicUser[]>([])
  const [selectedVaultInfo, setSelectedVaultInfo] = useState<number>(0)
  const consortiumId = useParams<{ consortiumId: string }>().consortiumId as string

  // React-Markdown custom renderers
  const markdownComponents: Components = useMemo(
    () => ({
      th: ({ children, ...props }) => {
        const text =
          Array.isArray(children)
            ? children
              .map((c) => (typeof c === 'string' ? c : ''))
              .join('')
              .trim()
            : typeof children === 'string'
              ? children.trim()
              : ''
        const dataCol = slugify(text || 'col')
        return (
          <th {...props} data-col={dataCol}>
            {children}
          </th>
        )
      },
      table: ({ ...props }) => (
        <div className='table-wrapper'>
          <table {...props} />
        </div>
      ),
    }),
    [],
  )

  useEffect(() => {
    getVaultUserList()
      .then((res) => setVaultUserList(res))
      .catch((err) => console.error('Error fetching users:', err))
  }, [])

  const handleAdd = async (userId: string) => {
    try {
      await leaderAddVaultUser({ consortiumId, userId })
      onClose()
    } catch (error) {
      console.error('Error adding user:', error)
    }
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
                        onClick={() => handleAdd(id)}
                      >
                        Add
                      </Button>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={vault?.name || 'No Vault Assigned'}
                    secondary={username}
                    primaryTypographyProps={{ fontWeight: 'bold' }}
                    sx={{ flex: '0.75' }}
                  />
                </ListItem>
                <Divider component='li' />
              </React.Fragment>
            ))}
          </List>
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
    </>
  )
}

export default VaultUserList
