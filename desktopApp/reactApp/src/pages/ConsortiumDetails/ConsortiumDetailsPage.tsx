import { useState } from 'react'
import Grid from '@mui/material/Grid2'
import { Box, Button, Tab, Tabs } from '@mui/material'
import { Members } from './Members/Members'
import { TitleAndDescription } from './TitleAndDescription/TitleAndDescription'
import DirectorySelect from './DirectorySelect/DirectorySelect'
import { useUserState } from '../../contexts/UserStateContext'
import StartRunButton from './StartRunButton/StartRunButton'
import {
  ConsortiumDetailsProvider,
  useConsortiumDetailsContext,
} from './ConsortiumDetailsContext'
import { LatestRun } from './LatestRun/LatestRun'
import ComputationDisplay from './ComputationDisplay/ComputationDisplay'
import ConsortiumLeaderNotes from './ConsortiumLeaderNotes/ConsortiumLeaderNotes'
import Computation from './Computation/Computation'
import ComputationParameters from './ComputationParameters/ComputationParameters'
import ComputationLocalParameters from './ComputationLocalParameters/ComputationLocalParameters'
import { useNavigate, useParams } from 'react-router-dom'
import ConsortiumInviteModal from './Modals/ConsortiumInvite'
import ConsortiumDeleteModal from './Modals/ConsortiumDelete'

export function ConsortiumDetailsPage() {
  const { consortiumId } = useParams<{ consortiumId: string }>()
  const {
    data: {
      studyConfiguration,
      members,
      activeMembers,
      readyMembers,
      leader,
      title,
      description,
    },
    inviteConsortium,
    deleteConsortium,
    isLeader,
  } = useConsortiumDetailsContext()

  const { userId } = useUserState()
  const navigate = useNavigate()
  const isActive = activeMembers.some((member) => member.id === userId)

  const hasComputation = !!studyConfiguration?.computation
  // NOTE: using the misspelled key per your generated types
  const supportsLocal = !!studyConfiguration?.computation?.hasLocalParameters

  // Tabs only used when supportsLocal === true
  const [tab, setTab] = useState<'global' | 'local'>('global')

  // Delete dialog state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)

  return (
    <>
      <Grid container spacing={2} padding={2}>
        <Grid size={{ sm: 6, md: 4 }}>
          <TitleAndDescription title={title} description={description} />

          {isLeader && hasComputation && <StartRunButton />}
          {isActive && <DirectorySelect />}

          <Members
            members={members}
            activeMembers={activeMembers}
            readyMembers={readyMembers}
            leader={leader}
          />

          {studyConfiguration && (
            <ConsortiumLeaderNotes
              consortiumLeaderNotes={studyConfiguration?.consortiumLeaderNotes}
              showAccordion
            />
          )}
        </Grid>

        <Grid size={{ sm: 6, md: 4 }} className='consortium-details-grid-2'>
          <Box className='consortium-links'>
            <Button
              onClick={() => navigate(`/consortium/wizard/${consortiumId}`)}
              color='success'
              variant='outlined'
              size='small'
              style={{ marginRight: '0.5rem' }}
            >
              Setup
            </Button>
            <Button
              onClick={() => navigate('/consortium/list')}
              variant='outlined'
              size='small'
              style={{ marginRight: '0.5rem' }}
            >
              Consortia
            </Button>
            {isLeader && (
              <Button
                color='error'
                variant='outlined'
                size='small'
                onClick={() => setIsDeleteModalOpen(true)}
              >
                Delete
              </Button>
            )}
          </Box>

          <LatestRun />
          <Computation computation={studyConfiguration?.computation} />

          {/* Parameters area: two simple cases */}
          {hasComputation && (
            <Box borderRadius={2} marginBottom={0} bgcolor='white'>
              {supportsLocal ? (
                <>
                  <Tabs
                    value={tab}
                    onChange={(_e, v) => setTab(v)}
                    variant='fullWidth'
                    textColor='inherit'
                    TabIndicatorProps={{ sx: { backgroundColor: '#0066ff' } }}
                    sx={{
                      '& .MuiTab-root.Mui-selected': { color: '#0066ff' },
                      '& .MuiTab-root': {
                        color: 'inherit',
                        '&:hover': { color: '#0066ff' },
                        '&:focus': { color: '#0066ff' },
                      },
                    }}
                  >
                    <Tab label='Global Settings' value='global' />
                    <Tab label='Local Settings' value='local' />
                  </Tabs>

                  <Box role='tabpanel' hidden={tab !== 'global'} id='tabpanel-global' aria-labelledby='tab-global'>
                    {tab === 'global' && <ComputationParameters />}
                  </Box>
                  <Box role='tabpanel' hidden={tab !== 'local'} id='tabpanel-local' aria-labelledby='tab-local'>
                    {tab === 'local' && <ComputationLocalParameters />}
                  </Box>
                </>
              ) : (
                // Only Global, no tabs
                <Box>
                  <ComputationParameters />
                </Box>
              )}
            </Box>
          )}
        </Grid>

        <Grid size={{ sm: 12, md: 4 }} className='consortium-details-grid-3'>
          <Box className='consortium-links'>
            {isLeader && (
              <Button
                onClick={() => setIsInviteModalOpen(true)}
                color='secondary'
                variant='outlined'
                size='small'
                style={{ marginRight: '0.5rem' }}
              >
                Invite Participants
              </Button>
            )}
            <Button
              onClick={() => navigate(`/consortium/wizard/${consortiumId}`)}
              color='success'
              variant='outlined'
              size='small'
              style={{ marginRight: '0.5rem' }}
            >
              Setup Wizard
            </Button>
            <Button
              onClick={() => navigate('/consortium/list')}
              variant='outlined'
              size='small'
              style={{ marginRight: '0.5rem' }}
            >
              Consortia List
            </Button>
            {isLeader && (
              <Button
                color='error'
                variant='outlined'
                size='small'
                onClick={() => setIsDeleteModalOpen(true)}
              >
                Delete
              </Button>
            )}
          </Box>
          <ComputationDisplay notesHeading />
        </Grid>
      </Grid>

      {/* Invite Modal */}
      {isLeader && (
        <ConsortiumInviteModal
          open={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onInvite={inviteConsortium}
        />
      )}

      {/* Delete Modal */}
      {isLeader && (
        <ConsortiumDeleteModal
          open={isDeleteModalOpen}
          consortiumName={title}
          onClose={() => setIsDeleteModalOpen(false)}
          onNavigate={navigate}
          onDelete={deleteConsortium}
        />
      )}
    </>
  )
}

export default function ConsortiumDetailsPageWithProvider() {
  return (
    <ConsortiumDetailsProvider>
      <ConsortiumDetailsPage />
    </ConsortiumDetailsProvider>
  )
}
