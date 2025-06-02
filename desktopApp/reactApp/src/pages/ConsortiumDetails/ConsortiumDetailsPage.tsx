import Grid from '@mui/material/Grid2';
import { Box, Button } from "@mui/material";
import { Members } from "./Members/Members";
import { TitleAndDescription } from "./TitleAndDescription/TitleAndDescription";
import DirectorySelect from "./DirectorySelect/DirectorySelect";
import { useUserState } from "../../contexts/UserStateContext";
import StartRunButton from "./StartRunButton/StartRunButton";
import { ConsortiumDetailsProvider, useConsortiumDetailsContext } from "./ConsortiumDetailsContext";
import { LatestRun } from "./LatestRun/LatestRun";
import ComputationDisplay from "./ComputationDisplay/ComputationDisplay";
import ConsortiumLeaderNotes from "./ConsortiumLeaderNotes/ConsortiumLeaderNotes";
import Computation from "./Computation/Computation";
import ComputationParameters from "./ComputationParameters/ComputationParameters";
import { useNavigate, useParams } from 'react-router-dom';

export function ConsortiumDetailsPage() {
    const { consortiumId } = useParams<{ consortiumId: string }>();
    const { data: { studyConfiguration, members, activeMembers, readyMembers, leader, title, description }, status: { loading, error }, isLeader } = useConsortiumDetailsContext();
    const { userId } = useUserState();
    const navigate = useNavigate();

    const isActive = activeMembers.some((member) => member.id === userId);

    return (
        <Grid container spacing={2} padding={2}>
            <Grid size={{ sm: 6, md: 4 }}>
                {/* Title and Description Section */}
                <TitleAndDescription title={title} description={description} />


                {/* Start Run Button Section (only if leader a computation has been selected) */}
                {isLeader && studyConfiguration?.computation && (
                    <StartRunButton />
                )}

                {/* Directory Select Section (only if active) */}
                {isActive && (
                    <DirectorySelect />
                )}

                {/* Members Section */}
                <Members members={members} activeMembers={activeMembers} readyMembers={readyMembers} leader={leader} />

                {/* Leader Notes */}
                {studyConfiguration && <ConsortiumLeaderNotes consortiumLeaderNotes={studyConfiguration?.consortiumLeaderNotes} showAccordion={true} />}
            </Grid>
            <Grid size={{ sm: 6, md: 4 }} className="consortium-details-grid-2">
                {/* Consortium Links @ Smaller Viewport */}
                <Box className="consortium-links">
                    <Button onClick={() => navigate(`/consortium/wizard/${consortiumId}`)} variant='outlined' size='small' style={{marginRight:'0.5rem'}}>
                        Setup Wizard
                    </Button>
                    <Button onClick={() => navigate('/consortium/list')} variant='outlined' size='small'>
                        Consortia
                    </Button>
                </Box>
                {/* Latest Run */}
                <LatestRun />
                {/* Computation */}
                <Computation computation={studyConfiguration?.computation} />
                {/* Computation Parameters */}
                {studyConfiguration && studyConfiguration?.computation && <ComputationParameters />}
            </Grid>
            <Grid size={{ sm: 12, md: 4 }} className="consortium-details-grid-3">
                {/* Consortium Link @ Larger Viewport */}
                <Box className="consortium-links">
                    <Button onClick={() => navigate(`/consortium/wizard/${consortiumId}`)} variant='outlined' size='small' style={{marginRight:'0.5rem'}}>
                        Setup Wizard
                    </Button>
                    <Button onClick={() => navigate('/consortium/list')} variant='outlined' size='small'>
                        Consortia
                    </Button>
                </Box>
                {/* Computation Notes */}
                <ComputationDisplay notesHeading={true} />
            </Grid>
        </Grid>

    );
}


export default function ConsortiumDetailsPageWithProvider() {
    return <ConsortiumDetailsProvider>
        <ConsortiumDetailsPage />
    </ConsortiumDetailsProvider>
}