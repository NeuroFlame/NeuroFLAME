import { Box, Button, Typography } from "@mui/material";
import Grid from '@mui/material/Grid2';
import { useNavigate } from 'react-router-dom';
import { useRunResults } from "./useRunResults";

export default function RunResults() {
    const navigate = useNavigate();

    const {
        consortiumId,
        runId,
        fileList,
        loading,
        error,
        frameSrc,
        setFrameSrc,
        edgeClientRunResultsUrl,
        filesPanelWidth,
        filesPanelShow,
        iframePanelWidth,
        iframeExpanded,
        arrowForwardShow,
        handleHideFiles,
        handleShowFiles
    } = useRunResults();

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;

    return (
        <Grid container spacing={2} padding={2}>
            <Grid size={{ sm: 12 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <h1>Run Results: <span style={{ color: 'black' }}>{runId}</span></h1>
                    <Box textAlign="right">
                        <Button
                            variant="contained"
                            color="primary"
                            style={{ margin: '0 0 1rem 0' }}
                            onClick={() => navigate(`/consortium/details/${consortiumId}`)}
                        >
                            View Consortium
                        </Button>
                        <Button
                            variant="contained"
                            color="success"
                            style={{ margin: '0 0 1rem 1rem' }}
                            onClick={() => navigate(`/run/details/${runId}`)}
                        >
                            View Run Details
                        </Button>
                        <Button
                            variant="outlined"
                            color="primary"
                            style={{ margin: '0 0 1rem 1rem' }}
                            href={`${edgeClientRunResultsUrl}/zip/${consortiumId}/${runId}/?x-access-token=${localStorage.getItem('accessToken')}`}
                        >
                            Download Results
                        </Button>
                    </Box>
                </Box>
            </Grid>
            <Grid size={filesPanelWidth} style={{ transition: 'width 0.5s' }}>
                <Box display={filesPanelShow}>
                    <Typography variant='h6' style={{ marginTop: '2rem' }}>Files:</Typography>
                    <ul style={{ listStyle: 'none', margin: '0', padding: '0' }}>
                        {fileList.map((file, index) => (
                            <li key={index}>
                                <button
                                    style={{ background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer', padding: '0' }}
                                    onClick={() => setFrameSrc(`${edgeClientRunResultsUrl}/${file.url}?x-access-token=${localStorage.getItem('accessToken')}`)}
                                >
                                    {file.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </Box>
            </Grid>
            <Grid size={iframePanelWidth} style={iframeExpanded ? { transition: 'width 0.5s', marginTop: '-1rem' } : { transition: 'width 0.5s', marginTop: '0rem' }}>
                <Button variant='text' size="small" onClick={handleShowFiles} style={{ display: arrowForwardShow, background: 'white' }}>
                    Show Result Files
                </Button>
                <Button variant='text' size="small" onClick={handleHideFiles} style={{ display: filesPanelShow, background: 'white' }}>
                    Expand Results Panel
                </Button>
                <Box>
                    {frameSrc ? <iframe
                        // put the token in the URL to authenticate the request
                        src={frameSrc}
                        title={`Run Result`}
                        width="100%"
                        height="100%"
                        sandbox="allow-same-origin"
                        style={{ border: 'none', background: 'white', height: 'calc(100vh - 170px)' }}
                    /> :
                        <div style={{ background: 'white', height: 'calc(100vh - 225px)', padding: '1rem' }}>
                            <h2>No index.html file in the output folder.</h2>
                            <p>You're welcome to view the files on the left.</p>
                        </div>}
                </Box>
            </Grid>
        </Grid>
    );
}
