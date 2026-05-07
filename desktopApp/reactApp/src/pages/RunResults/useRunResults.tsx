import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  lastModified: string;
  url: string; // This is relative: consortiumId/runId/results/...
}

export function useRunResults() {
  const {
    consortiumId,
    runId,
  } = useParams<{ consortiumId: string, runId: string }>()
  const [fileList, setFileList] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [frameSrc, setFrameSrc] = useState<string | null>(null)
  const [indexSrc, setIndexSrc] = useState<string | null>(null)
  const [
    edgeClientRunResultsUrl,
    setEdgeClientRunResultsUrl,
  ] = useState<string | null>(null)
  const [
    filesPanelWidth,
    setFilesPanelWidth,
  ] = useState<object>({ sm: 3, md: 2 })
  const [filesPanelShow, setFilesPanelShow] = useState<string>('inline')
  const [
    iframePanelWidth,
    setIframePanelWidth,
  ] = useState<object>({ sm: 9, md: 10 })
  const [iframeExpanded, setIframeExpanded] = useState<boolean>(false)
  const [arrowForwardShow, setArrowForwardShow] = useState<string>('none')

  const fetchRecursive = async (
    relativePath: string,
  ): Promise<FileInfo[]> => {
    const normalizedPath = relativePath.replace(/^\/+/, '') // remove leading slashes
    const fullUrl = `${edgeClientRunResultsUrl}/${normalizedPath}${normalizedPath.endsWith('/') ? '' : '/'}`

    try {
      const response = await axios.get<FileInfo[]>(fullUrl)

      const files: FileInfo[] = []

      for (const file of response.data) {
        files.push(file)

        if (file.isDirectory) {
          try {
            const nested = await fetchRecursive(file.url)
            files.push(...nested)
          } catch (err) {
            console.warn(`Skipping inaccessible directory: ${file.url}`, err)
          }
        }
      }

      return files
    } catch (err) {
      console.error(`Failed to fetch path: ${fullUrl}`, err)
      throw err
    }
  }

  useEffect(() => {
    const fetchEdgeClientRunResultsUrl = async () => {
      const { edgeClientRunResultsUrl } = await window.ElectronAPI.getConfig()
      setEdgeClientRunResultsUrl(edgeClientRunResultsUrl)
    }
    fetchEdgeClientRunResultsUrl()
  }, [])

  useEffect(() => {
    if (!edgeClientRunResultsUrl || !consortiumId || !runId) return

    const fetchResultsFilesList = async () => {
      try {
        const basePath = `${consortiumId}/${runId}`
        const files = await fetchRecursive(basePath)

        const indexFile = files.find((file) =>
          file.name === 'index.html' && file.url.endsWith('/index.html'),
        )

        if (indexFile && !frameSrc) {
          const src = `${edgeClientRunResultsUrl}/${indexFile.url}`
          setFrameSrc(src)
          setIndexSrc(src)
        }

        setFileList(files)
      } catch (err) {
        setError('Failed to fetch results')
        console.error('Error fetching results:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchResultsFilesList()
  }, [edgeClientRunResultsUrl, consortiumId, runId, frameSrc])

  const handleHideFiles = () => {
    setFilesPanelWidth({ sm: 0, md: 0 })
    setFilesPanelShow('none')
    setIframePanelWidth({ sm: 12, md: 12 })
    setArrowForwardShow('inline')
    setIframeExpanded(true)
  }

  const handleShowFiles = () => {
    setFilesPanelWidth({ sm: 3, md: 2 })
    setFilesPanelShow('inline')
    setIframePanelWidth({ sm: 9, md: 10 })
    setArrowForwardShow('none')
    setIframeExpanded(false)
  }

  return {
    consortiumId,
    runId,
    fileList,
    loading,
    error,
    frameSrc,
    setFrameSrc,
    indexSrc,
    edgeClientRunResultsUrl,
    filesPanelWidth,
    filesPanelShow,
    iframePanelWidth,
    iframeExpanded,
    arrowForwardShow,
    handleHideFiles,
    handleShowFiles,
  }
}
