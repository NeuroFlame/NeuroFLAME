import React, { useState } from 'react'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import DescriptionIcon from '@mui/icons-material/Description'
import ImageIcon from '@mui/icons-material/Image'
import CodeIcon from '@mui/icons-material/Code'
import DataObjectIcon from '@mui/icons-material/DataObject'

type FileItem = {
  name: string;
  url: string;
  displayUrl: string;
  size: number;
  lastModified: string;
  isDirectory: boolean;
}

type TreeNode = {
  [key: string]: TreeNode | FileLeaf;
}

type FileLeaf = {
  __isFile: true;
  name: string;
  url: string;
  size: number;
  lastModified: string;
}

type FileTreeProps = {
  fileList: FileItem[];
  setFrameSrc: (src: string) => void;
  setCurrentFile: (src: string) => void;
  edgeClientRunResultsUrl: string;
}

function buildFileTree(files: FileItem[]): TreeNode {
  const root: TreeNode = {}

  files.forEach(({
    name,
    url,
    displayUrl,
    isDirectory,
    size,
    lastModified,
  }) => {
    const parts = displayUrl.split('/')
    let current: TreeNode = root

    parts.forEach((part, idx) => {
      const isLast = idx === parts.length - 1
      const isFile = isLast && !isDirectory

      if (!current[part]) {
        if (isFile) {
          current[part] = {
            __isFile: true,
            name,
            url,
            size,
            lastModified,
          }
        } else {
          current[part] = {}
        }
      }

      current = current[part] as TreeNode
    })
  })

  return root
}

type RenderTreeProps = {
  tree: TreeNode;
  setFrameSrc: (src: string) => void;
  setCurrentFile: (src: string) => void;
  edgeClientRunResultsUrl: string;
  accessToken: string | null;
  depth?: number;
}

const Folder: React.FC<{
  name: string;
  children: React.ReactNode;
}> = ({ name, children }) => {
  const [open, setOpen] = useState(false)
  return (
    <li style={{ margin: '0.5rem 0' }}>
      <div
        style={{
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          marginBottom: '0.25rem',
        }}
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <FolderOpenIcon fontSize='small' />
        ) : (
          <FolderIcon fontSize='small' />
        )}
        <span style={{ marginLeft: '0.5rem' }}>{name}</span>
      </div>
      {open && children}
    </li>
  )
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext) {
    return <InsertDriveFileIcon fontSize='small' />
  }
  if (['csv', 'tsv', 'txt'].includes(ext)) {
    return <DescriptionIcon fontSize='small' />
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) {
    return <ImageIcon fontSize='small' />
  }
  if (['html', 'js', 'ts'].includes(ext)) {
    return <CodeIcon fontSize='small' />
  }
  if (['mat', 'npy', 'h5'].includes(ext)) {
    return <DataObjectIcon fontSize='small' />
  }
  return <InsertDriveFileIcon fontSize='small' />
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function RenderTree({
  tree,
  setFrameSrc,
  setCurrentFile,
  edgeClientRunResultsUrl,
  accessToken,
  depth = 0,
}: RenderTreeProps) {
  const entries = Object.entries(tree)

  const sorted = entries.sort(([aKey, aVal], [bKey, bVal]) => {
    const aIsFile = '__isFile' in aVal
    const bIsFile = '__isFile' in bVal
    if (aIsFile !== bIsFile) return aIsFile ? 1 : -1 // folders first
    return aKey.localeCompare(bKey)
  })

  return (
    <ul style={{ listStyle: 'none', marginLeft: `${depth * 1.25}rem`, paddingLeft: 0 }}>
      {sorted.map(([key, value]) => {
        const isFile = '__isFile' in value && (value as FileLeaf).__isFile

        if (isFile) {
          const file = value as FileLeaf
          return (
            <li
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {getFileIcon(file.name)}
              <div>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0066FF',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: '0 0.25rem',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                  }}
                  onClick={() => {
                    if (!accessToken) {
                      console.error('Missing access token')
                      return
                    }

                    const fullUrl = `${edgeClientRunResultsUrl}/${file.url}?x-access-token=${accessToken}`
                    console.log(fullUrl)
                    setFrameSrc(fullUrl)
                    setCurrentFile(file.name)
                  }}
                >
                  {file.name}
                </button>
                <div
                  style={{
                    width: '100%',
                    padding: '0 0 0 2px',
                    margin: 0,
                    fontSize: '0.6rem',
                    color: '#666',
                  }}
                >
                  ({formatBytes(file.size)}, {new Date(file.lastModified).toLocaleDateString()})
                </div>
              </div>
            </li>
          )
        } else {
          return (
            <Folder key={key} name={key}>
              <RenderTree
                tree={value as TreeNode}
                setFrameSrc={setFrameSrc}
                setCurrentFile={setCurrentFile}
                edgeClientRunResultsUrl={edgeClientRunResultsUrl}
                accessToken={accessToken}
                depth={depth + 1}
              />
            </Folder>
          )
        }
      })}
    </ul>
  )
}

export default function FileTree({
  fileList,
  setFrameSrc,
  setCurrentFile,
  edgeClientRunResultsUrl,
}: FileTreeProps) {
  const accessToken = localStorage.getItem('accessToken')
  const tree = buildFileTree(fileList)

  return (
    <RenderTree
      tree={tree}
      setFrameSrc={setFrameSrc}
      setCurrentFile={setCurrentFile}
      edgeClientRunResultsUrl={edgeClientRunResultsUrl}
      accessToken={accessToken}
      depth={0}
    />
  )
}
