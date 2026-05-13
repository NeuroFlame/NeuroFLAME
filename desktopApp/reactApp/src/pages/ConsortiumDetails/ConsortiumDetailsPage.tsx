import { useState } from 'react'
import Grid from '@mui/material/Grid2'
import { Box, Button, Tabs, Tab, Switch, FormControlLabel } from '@mui/material'
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

function ConsortiumActions({
  consortiumId,
  isLeader,
  isPrivate,
  isLoading,
  onPrivacyChange,
  onInvite,
  onDelete,
  onNavigate,
}: {
  consortiumId?: string
  isLeader: boolean
  isPrivate: boolean
  isLoading: boolean
  onPrivacyChange: (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void
  onInvite: () => void
  onDelete: () => void
  onNavigate: (_: string) => void
}) {
  return (
    <Box className='consortium-actions'>
      {isLeader && (
        <FormControlLabel
          className='consortium-actions-private'
          control={
            <Switch
              checked={isPrivate}
              onChange={onPrivacyChange}
              color='primary'
              disabled={isLoading}
            />
          }
          label='Private'
        />
      )}
      {isLeader && (
        <Button
          onClick={onInvite}
          color='secondary'
          variant='outlined'
          size='small'
          className='consortium-actions-button'
        >
          Invite Participants
        </Button>
      )}
      <Button
        onClick={() => onNavigate(`/consortium/wizard/${consortiumId}`)}
        color='success'
        variant='outlined'
        size='small'
        className='consortium-actions-button'
      >
        Setup Wizard
      </Button>
      <Button
        onClick={() => onNavigate('/consortium/list')}
        variant='outlined'
        size='small'
        className='consortium-actions-button'
      >
        Consortia List
      </Button>
      {isLeader && (
        <Button
          color='error'
          variant='outlined'
          size='small'
          onClick={onDelete}
          className='consortium-actions-button'
        >
          Delete
        </Button>
      )}
    </Box>
  )
}

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
      isPrivate,
    },
    inviteConsortium,
    status,
    deleteConsortium,
    isLeader,
    updateConsortiumPrivacy,
  } = useConsortiumDetailsContext()

  const { userId } = useUserState()
  const navigate = useNavigate()
  const isActive = activeMembers.some((member) => member.id === userId)

  const hasComputation = !!studyConfiguration?.computation
  // NOTE: using the misspelled key per your generated types
  const supportsLocal = !!studyConfiguration?.computation?.hasLocalParameters
  const leaderNotes = studyConfiguration?.consortiumLeaderNotes
  const hasLeaderNotesContent = !!leaderNotes?.trim()

  // Tabs only used when supportsLocal === true
  const [tab, setTab] = useState<'global' | 'local'>('global')

  // Delete dialog state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)

  const handlePrivacyChange = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    updateConsortiumPrivacy(checked).catch(() => {})
  }

  return (
    <>
      <Grid container spacing={2} padding={2}>
          <Grid 
            container
            size={12} 
            spacing={0} 
            padding={0} 
          >
          <Grid size={{ xs: 12, sm: 6 }} justifyContent='flex-start' alignItems='bottom'>
            <TitleAndDescription title={title} description={description} />
          </Grid>
          <Grid 
            size={{ xs: 12, sm: 6 }}  
            alignItems='bottom'>
            <ConsortiumActions
              consortiumId={consortiumId}
              isLeader={isLeader}
              isPrivate={isPrivate}
              isLoading={status.loading}
              onPrivacyChange={handlePrivacyChange}
              onInvite={() => setIsInviteModalOpen(true)}
              onDelete={() => setIsDeleteModalOpen(true)}
              onNavigate={navigate}
            />
          </Grid>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>

          {isLeader && hasComputation && <StartRunButton />}
          {isActive && <DirectorySelect />}

          <Members
            members={members}
            activeMembers={activeMembers}
            readyMembers={readyMembers}
            leader={leader}
          />

          {(isLeader || hasLeaderNotesContent) && (
            <ConsortiumLeaderNotes
              consortiumLeaderNotes={leaderNotes || ''}
              showAccordion
            />
          )}
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }} className='consortium-details-grid-2'>
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
