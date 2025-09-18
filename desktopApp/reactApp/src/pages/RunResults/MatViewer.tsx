import { useEffect, useState } from 'react'
import { File, Group, Dataset, h5wasm, FS } from 'h5wasm'

interface MatViewerProps {
  fileUrl: string;
}

interface TreeNode {
  path: string;
  key: string;
  value: any;
  children?: TreeNode[];
  expanded?: boolean;
  isExpandable?: boolean;
}

export default function MatViewer({ fileUrl }: MatViewerProps) {
  const [treeData, setTreeData] = useState<TreeNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchMat = async () => {
      try {
        await h5wasm.ready

        const response = await fetch(fileUrl)
        const buffer = await response.arrayBuffer()
        if (buffer.byteLength > 5 * 1024 * 1024) {
          setError('File too large to display. Please open it externally.')
          return
        }

        const uint8Array = new Uint8Array(buffer)
        const filename = '/temp.mat'
        FS?.writeFile(filename, uint8Array)
        const file = new File(filename, 'r')

        const root = await extractGroup(file, '/')
        for (const node of root) {
          if (node.isExpandable && node.children) {
            for (const child of node.children) {
              if (child.isExpandable && !child.children) {
                child.expanded = false
              }
            }
            node.expanded = true
          }
        }
        setTreeData(root)
      } catch (err: any) {
        console.error('❌ Error loading .mat file:', err)
        setError('Unable to load .mat file.')
      }
    }

    fetchMat()
  }, [fileUrl])

  const isObjectOrArray = (val: any) => val && typeof val === 'object'

  const extractGroup = async (
    group: Group,
    basePath = '/',
  ): Promise<TreeNode[]> => {
    const keys = group.keys()
    const result: TreeNode[] = []

    for (const key of keys) {
      const entity = group.get(key)
      const fullPath = basePath.endsWith('/') ? `${basePath}${key}` : `${basePath}/${key}`

      if (entity instanceof Dataset) {
        const val = await entity.value
        result.push({
          path: fullPath,
          key,
          value: val,
          children: getChildren(val, fullPath),
          expanded: false,
          isExpandable: isObjectOrArray(val),
        })
      } else if (entity instanceof Group) {
        const children = await extractGroup(entity, fullPath)
        result.push({
          path: fullPath,
          key,
          value: '[Group]',
          children,
          expanded: false,
          isExpandable: true,
        })
      } else {
        result.push({ path: fullPath, key, value: '[Unknown]' })
      }
    }

    return result
  }

  const decodeTypedArray = (val: any): any => {
    try {
      const uint8 = new Uint8Array(val.buffer)
      const clean = Array.from(uint8).filter((b) => b !== 0)

      const asciiStr = String.fromCharCode(...clean)

      // Heuristic: if mostly printable characters, it's probably a string
      const printableRatio = asciiStr.split('').filter((c) => /^[\x20-\x7E]$/.test(c)).length / asciiStr.length

      if (asciiStr.length > 0 && printableRatio > 0.85) {
        return asciiStr
      }

      return clean
    } catch (err) {
      return Array.from(new Uint8Array(val.buffer))
    }
  }

  const getChildren = (val: any, basePath: string): TreeNode[] | undefined => {
    if (!isObjectOrArray(val)) return
    const children: TreeNode[] = []

    if (ArrayBuffer.isView(val)) {
      const decoded = decodeTypedArray(val)
      if (typeof decoded === 'string') {
        return [{
          path: basePath,
          key: '0',
          value: decoded,
          isExpandable: false,
        }]
      } else {
        decoded.forEach((v: number, i: number) => {
          children.push({ path: `${basePath}[${i}]`, key: `${i}`, value: v, isExpandable: false })
        })
      }
    } else if (Array.isArray(val)) {
      val.forEach((v, i) => {
        children.push({
          path: `${basePath}[${i}]`,
          key: `[${i}]`,
          value: v,
          children: getChildren(v, `${basePath}[${i}]`),
          expanded: false,
          isExpandable: isObjectOrArray(v),
        })
      })
    } else {
      Object.keys(val).forEach((k) => {
        const v = val[k]
        let displayValue = v
        if (ArrayBuffer.isView(v)) {
          displayValue = decodeTypedArray(v)
        }
        children.push({
          path: `${basePath}/${k}`,
          key: k,
          value: displayValue,
          children: getChildren(displayValue, `${basePath}/${k}`),
          expanded: false,
          isExpandable: isObjectOrArray(displayValue),
        })
      })
    }

    return children.length > 0 ? children : undefined
  }

  const toggleExpand = async (node: TreeNode) => {
    if (!node.children && node.isExpandable) {
      setLoadingKeys((prev) => new Set(prev).add(node.path))
      try {
        const file = new File('/temp.mat', 'r')
        const entity = file.get(node.path)
        if (entity instanceof Group) {
          const children = await extractGroup(entity, node.path)
          node.children = children
        }
      } catch (err) {
        console.error(`Error expanding ${node.path}:`, err)
      } finally {
        setLoadingKeys((prev) => {
          const copy = new Set(prev)
          copy.delete(node.path)
          return copy
        })
      }
    }

    node.expanded = !node.expanded
    setTreeData([...treeData!])
  }

  const renderTree = (nodes: TreeNode[], depth = 0) => (
    <ul style={{ paddingLeft: `${depth * 0.5}rem`, listStyle: 'none', marginBottom: 0 }}>
      {nodes.map((node) => (
        <li key={node.path}>
          <div
            style={{
              cursor: node.isExpandable ? 'pointer' : 'default',
              userSelect: 'none',
            }}
            onClick={() => node.isExpandable && toggleExpand(node)}
          >
            {node.isExpandable ? (node.expanded ? '▼' : '▶') : '•'}{' '}
            <strong>{node.key}</strong>: {
              (() => {
                if (loadingKeys.has(node.path)) return '⏳ Loading...'
                const val = node.value
                if (val === null) return 'null'
                if (typeof val === 'string') return `"${val}"`
                if (Array.isArray(val)) return `[Array (${val.length})]`
                if (typeof val === 'object') {
                  if ('ref_data' in val) return '[RefObject]'
                  return '[Object]'
                }
                return String(val)
              })()
            }
          </div>
          {node.expanded &&
            node.children &&
              renderTree(node.children, depth + 1)}
        </li>
      ))}
    </ul>
  )

  return (
    <div style={{ background: '#f8f8f8', padding: '1rem' }}>
      {error ? (
        <div style={{ color: 'red' }}>{error}</div>
      ) : treeData ? renderTree(treeData) : 'Loading .mat file...'}
    </div>
  )
};
