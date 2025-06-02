import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Button, Box, Typography } from '@mui/material'; 
import StepSelectComputation from './steps/StepSelectComputation';
import StepSetParameters from './steps/StepSetParameters';
import StepSelectData from './steps/StepSelectData';
import StepAddNotes from './steps/StepAddNotes';
import StepDownloadImage from './steps/StepDownloadImage';
import StepSetReady from './steps/StepSetReady';
import StepViewRequirements from './steps/StepViewRequirements';
import ConsortiumWizardNavBar from './ConsortiumWizardNavBar';
import { ConsortiumDetailsProvider } from '../ConsortiumDetails/ConsortiumDetailsContext';
import { useConsortiumDetailsContext } from "../ConsortiumDetails/ConsortiumDetailsContext";
import { useCentralApi } from "../../apis/centralApi/centralApi";
import { useUserState } from '../../contexts/UserStateContext';

const ConsortiumWizard = () => {

    interface StepsType {
        label: string;
        path: string;
      }

    const memberSteps = [
        { label: 'View Consortium Requirements', path: 'step-view-requirements' },
        { label: 'Select Data Directory', path: 'step-select-data' },
        { label: 'Download Computation Image', path: 'step-download-image' },
        { label: 'Set Ready Status', path: 'step-set-ready' }
    ]

    const leaderSteps = [
        { label: 'Select Computation', path: 'step-select-computation' },
        { label: 'Download Computation Image', path: 'step-download-image' },
        { label: 'Set Parameters', path: 'step-set-parameters' },
        { label: 'Select Data Directory', path: 'step-select-data' },
        { label: 'Add Leader Notes', path: 'step-add-notes' },
        { label: 'Set Ready Status', path: 'step-set-ready' }
    ]

    const [step, setStep] = useState<number>(0); // Step index starts at 0
    const [steps, setSteps] = useState<StepsType[]>([]);
    const [isReady, setIsReady] = useState<boolean>(false);
    const navigate = useNavigate();

    const { consortiumLeave } = useCentralApi();

    const handleNext = () => {
        if (steps && steps.length > 0 && step < steps.length - 1) {
            setStep(step + 1);
            navigate(steps[step + 1].path);
        }
    };

    const handleBack = () => {
        if (steps && steps.length > 0 && step > 0) {
            setStep(step - 1);
            navigate(steps[step - 1].path);
        }
    };

    const handleStepNav = (path:string) => {
        if (path) {
            navigate(path);
        }
    }

    const { consortiumId } = useParams<{ consortiumId: string }>();
    const {data, isLeader} = useConsortiumDetailsContext();
    const { userId } = useUserState();
    const { readyMembers } = data;

    useEffect(() => {
        if( isLeader ){
            setSteps(leaderSteps);
        }else{
            setSteps(memberSteps);     
        }
    }, [isLeader])

    useEffect(() => {
        if(steps.length > 0){
            navigate(steps[0].path);
        }
    }, [steps])

    useEffect(() => {
        const userIsReady = readyMembers.some(user => user.id === userId);
        setIsReady(userIsReady);
    }, [readyMembers]);

    // Handler to navigate to consortium control panel
    const handleNavigateToConsortiumDetails = () => {
        if (consortiumId) {
            navigate(`/consortium/details/${consortiumId}`);
        }
    };

    const handleCancelAndExit = async () => {
        if(consortiumId){
            try {
                await consortiumLeave({ consortiumId: consortiumId });
                // You can refetch or update the UI state to reflect the change
            } catch (error) {
                console.error("Failed to leave the consortium:", error);
            } finally {
                navigate('/consortium/list');
            }
        }
    }

    return (
        <>
        {steps && steps.length > 0 && <Box style={{
            margin: '2rem 2rem 0',
            padding: '2rem 1rem',
            background: 'white',
            borderRadius: '1rem',
            height: 'calc(100vh - 13rem)'
        }}>
            <ConsortiumWizardNavBar steps={steps} currentStep={step} handleStepNav={handleStepNav} />
            <Box style={{margin: '2rem 1rem 1rem'}}>
                <Typography variant="h6" gutterBottom color="black">
                    {isLeader ? 'Consortium Setup Wizard' : `Consortium: ${data.title}`} 
                </Typography>
                <Typography variant="h5" gutterBottom>
                        Step {step + 1}: {steps[step].label}
                </Typography>
            </Box>
            {/* Step Routes */}
            <Box style={{margin: '0 1rem 2rem'}}>   
                <Routes>
                    <Route path="step-select-computation" element={<StepSelectComputation />} />
                    <Route path="step-set-parameters" element={<StepSetParameters />} />
                    <Route path="step-select-data" element={<StepSelectData />} />
                    <Route path="step-download-image" element={<StepDownloadImage />} />
                    <Route path="step-add-notes" element={<StepAddNotes />} />
                    <Route path="step-set-ready" element={<StepSetReady />} />
                    <Route path="step-view-requirements" element={<StepViewRequirements />} />
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
                    justifyContent: 'space-between'
                }}>
                {step === 0 && !isReady && <Button
                variant='outlined'
                color="primary"
                onClick={handleCancelAndExit}
                >Cancel & Leave</Button>}
                {step > 0 && <Button
                variant="contained"
                onClick={handleBack}>
                Go Back A Step
                </Button>}
                {(isReady || step === steps.length - 1) && (
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleNavigateToConsortiumDetails}
                >
                    View Consortium Details
                </Button>
                )}
                {step !== steps.length - 1 && <Button
                variant="contained"
                color="primary"
                onClick={handleNext}
                disabled={step >= steps.length - 1}
                >
                Go To Next Step
                </Button>}
            </Box>
        </Box>}
        </>
    );
};


// Wrapped version with the Provider
export default function ConsortiumWizardWithProvider() {
    return (
        <ConsortiumDetailsProvider>
            <ConsortiumWizard />
        </ConsortiumDetailsProvider>
    );
}
