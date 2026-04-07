import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import ComputationList from './ComputationList'
import { useComputationSelect } from './useComputationSelect'
import { useConsortiumDetailsContext } from '../../ConsortiumDetailsContext'

export default function ComputationSelect({
  computation,
  refetch,
}: { computation: any, refetch: ()=>void }) {
  const {
    data: { members },
  } = useConsortiumDetailsContext()
  const {
    computations,
    loading,
    error,
    selectComputation,
  } = useComputationSelect()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const vaultMembers = members.filter((member) => Boolean(member.vault))
  const disabledReasons = computations.reduce<Record<string, string>>(
    (reasons, computationItem) => {
      const incompatibleVaults = vaultMembers.filter(
        (vaultMember) =>
          !(vaultMember.vault?.allowedComputations ?? []).some(
            (allowedComputation) => allowedComputation.id === computationItem.id,
          ),
      )

      if (incompatibleVaults.length > 0) {
        reasons[computationItem.id] = `Blocked by ${incompatibleVaults
          .map((vaultMember) => vaultMember.vault?.name || vaultMember.username)
          .join(', ')}`
      }

      return reasons
    },
    {},
  )
  const disabledComputationIds = Object.keys(disabledReasons)

  const handleSelectComputation = async (computationId: string) => {
    await selectComputation(computationId)
    refetch() // Refetch consortium details to update computation
    handleCloseModal() // Close modal after selection
  }

  return (
    <div>
      <Button
        variant='outlined'
        color='primary'
        onClick={handleOpenModal}
        size='small'
      >
        {computation ? 'Change' : 'Select A Computation'}
      </Button>

      <Dialog
        open={isModalOpen}
        onClose={handleCloseModal}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>Select a Computation</DialogTitle>
        <DialogContent>
          {vaultMembers.length > 0 && (
            <Alert severity='info' sx={{ mb: 2 }}>
              Only computations allowed by every vault currently in the consortium
              can be selected.
            </Alert>
          )}
          {loading && <p>Loading computations...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {!loading && !error && (
            <ComputationList
              computations={computations}
              disabledComputationIds={disabledComputationIds}
              disabledReasons={disabledReasons}
              onSelect={handleSelectComputation}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal} color='warning'>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
