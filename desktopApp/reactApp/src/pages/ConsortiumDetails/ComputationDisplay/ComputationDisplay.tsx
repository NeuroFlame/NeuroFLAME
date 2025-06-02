import { Computation } from "../../../apis/centralApi/generated/graphql";
import { Box, Typography, Card, CardContent } from "@mui/material";
import { Maybe } from "graphql/jsutils/Maybe";
import ReactMarkdown from 'react-markdown';
import { useConsortiumDetailsContext } from "../ConsortiumDetailsContext";


const ComputationDisplay: React.FC<{notesHeading: boolean}> = ({ notesHeading}) => {
    const {data: consortiumDetails} = useConsortiumDetailsContext();
    const computation = consortiumDetails?.studyConfiguration?.computation as Maybe<Computation>;

    if (!computation) {
        return (
            <Card>
                <CardContent>
                    <Typography fontSize="11px">Computation Notes:</Typography>
                </CardContent>
            </Card>
        );
    }

    const { title, notes, imageName } = computation;

    return (
        <Box
            className="computation-notes"
            borderRadius={2}
            marginBottom={2}
            bgcolor={'white'}
        >
            <div id="compnotes" />{/* For Notes anchor placement at 800px wide */}
            <CardContent>
                {notesHeading && <Typography fontSize="11px">Computation Notes:</Typography>}
                <Typography variant="h5" fontWeight="600" color="black">{title}</Typography>
                <Typography variant="body2" color="textSecondary">
                    {imageName}
                </Typography>
                <Box marginTop="1rem">
                    <ReactMarkdown>{notes}</ReactMarkdown>
                </Box>
            </CardContent>
        </Box>
    );
}

export default ComputationDisplay;
