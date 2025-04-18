import React, { useEffect, useState } from 'react';
import { useParams } from "react-router-dom";
import axios from 'axios';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  lastModified: string;
  url: string; // This is relative: consortiumId/runId/results/...
}

export function useRunResults() {
  const { consortiumId, runId } = useParams<{ consortiumId: string, runId: string }>();
  const [fileList, setFileList] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [edgeClientRunResultsUrl, setEdgeClientRunResultsUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchEdgeClientRunResultsUrl = async () => {
      const { edgeClientRunResultsUrl } = await window.ElectronAPI.getConfig();
      setEdgeClientRunResultsUrl(edgeClientRunResultsUrl);
    };
    fetchEdgeClientRunResultsUrl();
  }, []);

  useEffect(() => {
    if (!edgeClientRunResultsUrl || !consortiumId || !runId) return;

    const fetchResultsFilesList = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        setError('Missing access token');
        return;
      }

      try {
        const apiUrl = `${edgeClientRunResultsUrl}/${consortiumId}/${runId}`;
        const response = await axios.get<FileInfo[]>(apiUrl, {
          headers: { 'x-access-token': accessToken }
        });

        const filesWithFullPath = response.data.map((file) => ({
          ...file,
          url: file.url  // Important: leave relative
        }));

        const indexFile = filesWithFullPath.find(file =>
          file.name === "index.html" &&
          file.url.endsWith('/index.html')
        );

        if (indexFile && !frameSrc) {
          setFrameSrc(`${edgeClientRunResultsUrl}/${indexFile.url}?x-access-token=${accessToken}`);
        }

        setFileList(filesWithFullPath);
      } catch (err) {
        setError('Failed to fetch results');
        console.error('Error fetching results:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResultsFilesList();
  }, [edgeClientRunResultsUrl, consortiumId, runId, frameSrc]);

  return {
    consortiumId,
    runId,
    fileList,
    loading,
    error,
    frameSrc,
    setFrameSrc,
    edgeClientRunResultsUrl,
  };
}
