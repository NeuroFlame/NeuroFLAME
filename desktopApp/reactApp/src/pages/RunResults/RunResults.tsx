import { useState } from 'react';
import { Box, Button, Typography } from "@mui/material";
import Grid from '@mui/material/Grid2';
import { useNavigate } from 'react-router-dom';
import { useRunResults } from "./useRunResults";
import FileTree from './FileTree';
import CSVViewer from './CSVViewer';
import MatViewer from './MatViewer';
import NiiVueViewer from './NiiVueViewer';
import TextViewer from './TextViewer';

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

  const [currentFile, setCurrentFile] = useState<string>('');

  if (loading) {
    return (
      <Grid container spacing={2} padding={2}>
        <Grid size={{ sm: 12 }}>
          <div>Loading...</div>
        </Grid>
      </Grid>
    );
  }

  if (error) {
    return (
      <Grid container spacing={2} padding={2}>
        <Grid size={{ sm: 12 }}>
          <Typography variant="h6" color="error" style={{ marginBottom: '1rem' }}>
            {error}
          </Typography>
          <Button variant="contained" color="primary" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </Grid>
      </Grid>
    );
  }

  const commonPrefix = (() => {
    if (!fileList.length) return '';
    const paths = fileList.map(file => file.url.split('/'));
    const first = paths[0];

    let prefix: string[] = [];
    for (let i = 0; i < first.length; i++) {
      const segment = first[i];
      if (paths.every(p => p[i] === segment)) {
        prefix.push(segment);
      } else {
        break;
      }
    }

    return prefix.join('/') + (prefix.length ? '/' : '');
  })();

  const fileListForTree = fileList.map(file => ({
    ...file,
    displayUrl: file.url.replace(commonPrefix, '') // ← for display only
  }));

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
              href={`${edgeClientRunResultsUrl}/zip/${consortiumId}/${runId}/?x-access-token=${localStorage.getItem('accessToken')}&window=self`}
            >
              Download Results
            </Button>
          </Box>
        </Box>
      </Grid>
      <Grid size={filesPanelWidth} style={{ transition: 'width 0.5s' }}>
        <Box display={filesPanelShow}>
          <Typography variant='h6' style={{ marginTop: '2rem' }}>Files:</Typography>
          <div style={{height: '75vh', overflowY: 'scroll'}}>
          <ul style={{ listStyle: 'none', margin: '0', padding: '0' }}>
            <FileTree
              fileList={fileListForTree}
              setFrameSrc={setFrameSrc}
              setCurrentFile={setCurrentFile}
              edgeClientRunResultsUrl={edgeClientRunResultsUrl ?? ''}
            />
          </ul>
          </div>
        </Box>
      </Grid>
      <Grid
        size={iframePanelWidth}
        style={iframeExpanded ? { transition: 'width 0.5s', marginTop: '-1rem' } : { transition: 'width 0.5s', marginTop: '0rem' }}
      >
        <Button
          variant='text'
          size="small"
          onClick={handleShowFiles}
          style={{ display: arrowForwardShow, background: 'white' }}
        >
          Show Result Files
        </Button>
        <Button
          variant='text'
          size="small"
          onClick={handleHideFiles}
          style={{ display: filesPanelShow, background: 'white' }}
        >
          Expand Results Panel
        </Button>
        <Box style={{background: '#fff', minHeight: 'calc(50vh)', padding: '0.25rem 1rem 1rem'}}>
          {currentFile && (
            <h3 style={{padding: '1rem 0 0'}}>
              <span style={{color: 'black'}}>Viewing:</span> {currentFile}
            </h3>
          )}
          {frameSrc ? (
            frameSrc.includes('.csv') ? (
              <CSVViewer fileUrl={frameSrc} />
            ) : frameSrc.includes('.nii') ? (
              <NiiVueViewer fileUrl={frameSrc} />
            ) : frameSrc.includes('.mat') ? (
              <MatViewer fileUrl={frameSrc} />
            ) : frameSrc.includes('.m') ? (
              <TextViewer fileUrl={frameSrc} />
            ) : (
              <iframe
                src={frameSrc}
                title="Run Result"
                width="100%"
                height="100%"
                sandbox="allow-same-origin"
                style={{ border: 'none', background: 'white', height: 'calc(100vh - 170px)' }}
              />
            )
          ) : (
            <div style={{ background: 'white', height: 'calc(100vh - 225px)', padding: '1rem' }}>
              <h2>No index.html file in the output folder.</h2>
              <p>You're welcome to view the files on the left.</p>
            </div>
          )}
        </Box>
      </Grid>
    </Grid>
  );
}
