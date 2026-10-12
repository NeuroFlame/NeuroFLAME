// components/TextViewer.tsx
import { useEffect, useState } from 'react'

export default function TextViewer({ fileUrl }: { fileUrl: string }) {
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    fetch(fileUrl)
      .then((res) => res.text())
      .then(setContent)
      .catch((err) => setContent(`Error loading file: ${err.message}`))
  }, [fileUrl])

  return (
    <pre
      style={{
        background: 'var(--nf-subtle)',
        padding: '1rem',
        whiteSpace: 'pre-wrap',
      }}
    >
      {content}
    </pre>
  )
}
