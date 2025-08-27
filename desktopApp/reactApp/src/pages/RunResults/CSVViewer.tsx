// CSVViewer.tsx
import { useEffect, useState } from 'react'
import Papa from 'papaparse'

interface CSVViewerProps {
  fileUrl: string;
}

export default function CSVViewer({ fileUrl }: CSVViewerProps) {
  const [data, setData] = useState<string[][] | null>(null)

  useEffect(() => {
    fetch(fileUrl)
      .then((res) => res.text())
      .then((text) => {
        const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true })
        setData(parsed.data)
      })
  }, [fileUrl])

  if (!data) return <div style={{ padding: '1rem' }}>Loading CSV...</div>

  return (
    <div style={{ overflowX: 'auto', background: 'white', height: 'calc(100vh - 170px)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {data[0].map((cell, idx) => (
              <th key={idx} style={{ border: '1px solid #ccc', padding: '4px', background: '#f9f9f9' }}>{typeof cell === 'string' ? cell.replace(/^[(']+|[)',]+$/g, '') : cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(1).map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ border: '1px solid #eee', padding: '4px' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
