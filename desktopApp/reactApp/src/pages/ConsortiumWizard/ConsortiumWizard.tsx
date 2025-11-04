import { useEffect, useState } from 'react'
import { Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Button, Box, Typography } from '@mui/material'
import StepSelectComputation from './steps/StepSelectComputation'
import StepSetParameters from './steps/StepSetParameters'
import StepSetLocalParameters from './steps/StepSetLocalParameters'
import StepSelectData from './steps/StepSelectData'
import StepAddNotes from './steps/StepAddNotes'
import StepDownloadImage from './steps/StepDownloadImage'
import StepSetReady from './steps/StepSetReady'
import StepViewRequirements from './steps/StepViewRequirements'
import ConsortiumWizardNavBar from './ConsortiumWizardNavBar'
import {
  ConsortiumDetailsProvider,
  useConsortiumDetailsContext,
} from '../ConsortiumDetails/ConsortiumDetailsContext'
import { useCentralApi } from '../../apis/centralApi/centralApi'
import { useUserState } from '../../contexts/UserStateContext'

const ConsortiumWizard = () => {
  interface StepsType {
    label: string;
    path: string;
  }

  const [step, setStep] = useState<number>(0)
  const [steps, setSteps] = useState<StepsType[]>([])
  const [isReady, setIsReady] = useState<boolean>(false)
  const navigate = useNavigate()
  const { consortiumLeave } = useCentralApi()

  const { consortiumId } = useParams<{ consortiumId: string }>()
  const { data, isLeader } = useConsortiumDetailsContext()
  const { userId } = useUserState()
  const { readyMembers } = data

  // Support flag straight from computation
  const supportsLocal =
    !!data?.studyConfiguration?.computation?.hasLocalParameters

  // Build step lists based on role AND supportsLocal
  const memberSteps: StepsType[] = [
    { label: 'View Consortium Requirements', path: 'step-view-requirements' },
    { label: 'Select Data Directory', path: 'step-select-data' },
    ...(supportsLocal
      ? [{ label: 'Set Local Parameters', path: 'step-set-local-parameters' } as StepsType]
      : []),
    { label: 'Download Computation Image', path: 'step-download-image' },
    { label: 'Set Ready Status', path: 'step-set-ready' },
  ]

  const leaderSteps: StepsType[] = [
    { label: 'Select Computation', path: 'step-select-computation' },
    { label: 'Download Computation Image', path: 'step-download-image' },
    { label: 'Set Parameters', path: 'step-set-parameters' },
    { label: 'Select Data Directory', path: 'step-select-data' },
    ...(supportsLocal
      ? [{ label: 'Set Local Parameters', path: 'step-set-local-parameters' } as StepsType]
      : []),
    { label: 'Add Leader Notes', path: 'step-add-notes' },
    { label: 'Set Ready Status', path: 'step-set-ready' },
  ]

  useEffect(() => {
    setSteps(isLeader ? leaderSteps : memberSteps)
    setStep(0) // reset to the first step whenever the set changes
  }, [isLeader, supportsLocal])

  useEffect(() => {
    if (steps.length > 0) {
      navigate(steps[0].path)
    }
  }, [steps])

  useEffect(() => {
    const userIsReady = readyMembers.some((user) => user.id === userId)
    setIsReady(userIsReady)
  }, [readyMembers, userId])

  const handleNext = () => {
    if (steps.length > 0 && step < steps.length - 1) {
      const next = step + 1
      setStep(next)
      navigate(steps[next].path)
    }
  }

  const handleBack = () => {
    if (steps.length > 0 && step > 0) {
      const prev = step - 1
      setStep(prev)
      navigate(steps[prev].path)
    }
  }

  const handleStepNav = (path: string) => {
    // only navigate to a path that exists in the current steps
    const exists = steps.some((s) => s.path === path)
    if (exists) {
      const idx = steps.findIndex((s) => s.path === path)
      setStep(idx)
      navigate(path)
    }
  }

  // Handler to navigate to consortium control panel
  const handleNavigateToConsortiumDetails = () => {
    if (consortiumId) {
      navigate(`/consortium/details/${consortiumId}`)
    }
  }

  const handleCancelAndExit = async () => {
    if (consortiumId) {
      try {
        await consortiumLeave({ consortiumId })
      } catch (error) {
        console.error('Failed to leave the consortium:', error)
      } finally {
        navigate('/consortium/list')
      }
    }
  }

  return (
    <>
      {steps.length > 0 && (
        <Box
          style={{
            margin: '2rem 2rem 0',
            padding: '2rem 1rem',
            background: 'white',
            borderRadius: '1rem',
            height: 'calc(100vh - 13rem)',
          }}
        >
          <ConsortiumWizardNavBar
            steps={steps}
            currentStep={step}
            handleStepNav={handleStepNav}
          />
          <Box style={{ margin: '2rem 1rem 1rem' }}>
            <Typography variant='h6' gutterBottom color='black'>
              {isLeader ? 'Consortium Setup Wizard' : `Consortium: ${data.title}`}
            </Typography>
            <Typography variant='h5' gutterBottom>
              Step {step + 1}: {steps[step].label}
            </Typography>
          </Box>

          {/* Step Routes */}
          <Box style={{ margin: '0 1rem 2rem' }}>
            <Routes>
              <Route path='step-select-computation' element={<StepSelectComputation />} />
              <Route path='step-set-parameters' element={<StepSetParameters />} />
              <Route path='step-select-data' element={<StepSelectData />} />
              {/* Only mount the Local Parameters route if supported */}
              {supportsLocal && (
                <Route path='step-set-local-parameters' element={<StepSetLocalParameters />} />
              )}
              <Route path='step-download-image' element={<StepDownloadImage />} />
              <Route path='step-add-notes' element={<StepAddNotes />} />
              <Route path='step-set-ready' element={<StepSetReady />} />
              <Route path='step-view-requirements' element={<StepViewRequirements />} />
            </Routes>
          </Box>

          {/* Control Panel Buttons */}
          <Box
            sx={{
              position: 'absolute',
              bottom: '4rem',
              width: 'calc(100% - 8rem)',
              display: 'flex',
              alignItems: 'center',
              margin: '0 1rem',
              justifyContent: 'space-between',
            }}
          >
            {step === 0 && !isReady && (
              <Button variant='outlined' color='primary' onClick={handleCancelAndExit}>
                Cancel & Leave
              </Button>
            )}
            {step > 0 && (
              <Button variant='contained' onClick={handleBack}>
                Go Back A Step
              </Button>
            )}
            {(isReady || step === steps.length - 1) && (
              <Button variant='outlined' color='primary' onClick={handleNavigateToConsortiumDetails}>
                View Consortium Details
              </Button>
            )}
            {step !== steps.length - 1 && (
              <Button
                variant='contained'
                color='primary'
                onClick={handleNext}
                disabled={step >= steps.length - 1}
              >
                Go To Next Step
              </Button>
            )}
          </Box>
        </Box>
      )}
    </>
  )
}

// Wrapped version with the Provider
export default function ConsortiumWizardWithProvider() {
  return (
    <ConsortiumDetailsProvider>
      <ConsortiumWizard />
    </ConsortiumDetailsProvider>
  )
}