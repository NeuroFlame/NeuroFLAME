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

  const fetchRecursive = async (relativePath: string, token: string): Promise<FileInfo[]> => {
    const fullUrl = `${edgeClientRunResultsUrl}/${relativePath}`.replace(/\/+$/, ''); // ensure no trailing slash
    const response = await axios.get<FileInfo[]>(fullUrl, {
      headers: { 'x-access-token': token },
    });

    const files: FileInfo[] = [];

    for (const file of response.data) {
      const fullFile: FileInfo = {
        ...file,
        url: file.url, // keep relative
      };

      files.push(fullFile);

      if (file.isDirectory) {
        const nested = await fetchRecursive(file.url, token);
        files.push(...nested);
      }
    }

    return files;
  };

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
        const basePath = `${consortiumId}/${runId}`;
        const files = await fetchRecursive(basePath, accessToken);

        const indexFile = files.find(file =>
          file.name === 'index.html' && file.url.endsWith('/index.html')
        );

        if (indexFile && !frameSrc) {
          setFrameSrc(`${edgeClientRunResultsUrl}/${indexFile.url}?x-access-token=${accessToken}`);
        }

        setFileList(files);
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
