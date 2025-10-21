import React, { useState, useEffect, useRef, forwardRef } from 'react'
import { electronApi } from '../../../apis/electronApi/electronApi'
import ScrollToBottom from 'react-scroll-to-bottom'
import { Box, Button, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

const ScrollToBottomWrapper = forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof ScrollToBottom>
>((props, ref) => <ScrollToBottom {...props} />)

const MATCHERS = [
  /"Id":\s*"sha256:/, // docker image inspect output
  /Status:\s+Downloaded newer image for/i,
  // optional: include the fully qualified repo line from Docker Hub
  /docker\.io\/coinstacteam\/nfc-single-round-ridge-regression-freesurfer:latest/i,
]

const TerminalWindow: React.FC<{ command: string }> = ({ command }) => {
  const [output, setOutput] = useState<string[]>([])
  const [isTerminalReady, setTerminalReady] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [imageExists, setImageExists] = useState(false)

  const imageExistsRef = useRef(false)
  useEffect(() => {
    imageExistsRef.current = imageExists
  }, [imageExists])

  const {
    spawnTerminal,
    terminalInput,
    terminalOutput,
    removeTerminalOutputListener,
  } = electronApi

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const lineIndicatesImage = (line: string) => MATCHERS.some((rx) => rx.test(line))

  // Wrapped setter that the Electron API will call.
  // It detects the match in real time and then updates `output`.
  const setOutputDetecting = (val: string[] | string | ((prev: string[]) => string[])) => {
    if (typeof val === 'function') {
      setOutput((prev) => {
        const next = val(prev)
        if (!imageExistsRef.current && next.some(lineIndicatesImage)) {
          setImageExists(true)
        }
        return Array.from(new Set(next))
      })
    } else {
      const incoming = Array.isArray(val) ? val : [val]
      setOutput((prev) => {
        const next = [...prev, ...incoming]
        if (!imageExistsRef.current && next.some(lineIndicatesImage)) {
          setImageExists(true)
        }
        const deduped = Array.from(new Set(next))
        // keep view scrolled
        queueMicrotask(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
        return deduped
      })
    }
  }

  useEffect(() => {
    if (!isTerminalReady) {
      spawnTerminal(setTerminalReady)
    }

    // IMPORTANT: register listener ONCE with (output, setOutput)
    // We pass our wrapped setter to get real-time detection.
    terminalOutput(output, setOutputDetecting)

    // Probe whether image already exists (flips `imageExists` from inspect output)
    const imageName = command.replace(/^docker\s+pull\s+/i, '')
    terminalInput(`docker image inspect ${imageName}`)

    return () => {
      removeTerminalOutputListener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once

  const handleButtonPress = (input: string) => {
    terminalInput(input)
    setShowTerminal(true)
  }

  return (
    <>
      {!imageExists && !showTerminal && (
        <Button
          variant="contained"
          size="small"
          onClick={() => handleButtonPress(command)}
          style={{ backgroundColor: '#0066FF' }}
        >
          Run Docker Pull
        </Button>
      )}

      {showTerminal && (
        <ScrollToBottomWrapper className="terminalWindow">
          {output.map((item, index) => (
            <div key={index} style={{ whiteSpace: 'nowrap' }}>
              &gt; {item}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollToBottomWrapper>
      )}

      <Box display="flex" justifyContent="space-between" alignContent="center">
        {imageExists && (
          <Box display="flex" justifyContent="flex-start" alignContent="center">
            <CheckCircleIcon sx={{ color: '#2FB600' }} />
            <Typography
              style={{
                fontSize: '0.8rem',
                lineHeight: '2',
                marginLeft: '0.25rem',
              }}
            >
              Docker Image Downloaded
            </Typography>
          </Box>
        )}
        {showTerminal && (
          <Button size="small" onClick={() => setShowTerminal(false)}>
            Hide Terminal
          </Button>
        )}
      </Box>
    </>
  )
}

export default TerminalWindow
