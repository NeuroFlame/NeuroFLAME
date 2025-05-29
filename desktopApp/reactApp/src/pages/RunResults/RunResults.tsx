import { Box, Button, Typography } from "@mui/material";
import Grid from '@mui/material/Grid2';
import { useNavigate } from 'react-router-dom';
import { useRunResults } from "./useRunResults";
import FileTree from './FileTree';

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
  } = useRunResults();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  
    const paths = fileList.map(file => file.url);
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
              onClick={() => navigate(`/consortium/details/${consortiumId}`)}
            >
              View Consortium
            </Button>
            <Button
              variant="contained"
              color="success"
              style={{ marginLeft: '1rem' }}
              onClick={() => navigate(`/run/details/${runId}`)}
            >
              View Run Details
            </Button>
          </Box>
        </Box>
      </Grid>

      <Grid size={3} style={{ transition: 'width 0.5s' }}>
        <Box>
          <Typography variant='h6'>Files:</Typography>
          <ul style={{ listStyle: 'none', margin: '0', padding: '0', overflowX: 'hidden', overflowY: 'scroll', height: 'calc(100vh - 210px)' }}>
            <FileTree
              fileList={fileListForTree}
              setFrameSrc={setFrameSrc}
              edgeClientRunResultsUrl={edgeClientRunResultsUrl ?? ''}
            />
          </ul>
        </Box>
      </Grid>

      <Grid size={9}>
        <Box>
          {frameSrc ? (
            <iframe
              src={frameSrc}
              title="Run Result"
              width="100%"
              height="100%"
              sandbox="allow-same-origin"
              style={{ border: 'none', background: 'white', height: 'calc(100vh - 170px)' }}
            />
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
