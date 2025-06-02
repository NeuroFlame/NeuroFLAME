import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepButton from '@mui/material/StepButton';

export default function ConsortiumWizardNavBar({
  steps,
  currentStep,
  handleStepNav,
}: {
  steps: Array<any>;
  currentStep: number;
  handleStepNav: (path: string) => void;
}) {
  return (
    <Stepper activeStep={currentStep} alternativeLabel>
      {steps.map((step, index) => (
        <Step key={step.label} completed={step.completed}>
          <StepButton
            onClick={() => handleStepNav(step.path)}
            sx={{
                '& .MuiSvgIcon-root': { fontSize: '2rem' },
                '& .Mui-active.MuiStepLabel-label': {fontWeight: 'bold' },
                '& .Mui-completed .MuiSvgIcon-root': { color: '#2FA84F' },
                '& .MuiStepButton-root.Mui-disabled': { background: 'none' }, 
            }}
          >
            {step.label}
          </StepButton>
        </Step>
      ))}
    </Stepper>
  );
}
