import React, { useState, useEffect, useRef, forwardRef } from 'react'
import { electronApi } from '../../../apis/electronApi/electronApi'
import ScrollToBottom from 'react-scroll-to-bottom'
import { Box, Button, Typography, CircularProgress } from '@mui/material'
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
  const [isSingularity, setIsSingularity] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [pullError, setPullError] = useState<string | null>(null)

  const imageExistsRef = useRef(false)
  useEffect(() => {
    imageExistsRef.current = imageExists
  }, [imageExists])

  const {
    spawnTerminal,
    terminalInput,
    terminalOutput,
    removeTerminalOutputListener,
    getConfig,
    checkSingularityImageExists,
    pullSingularityImage,
  } = electronApi

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Check if using Singularity
  useEffect(() => {
    const checkContainerService = async () => {
      try {
        const config = await getConfig()
        const usingSingularity = config?.edgeClientConfig?.containerService === 'singularity'
        setIsSingularity(usingSingularity || false)
        
        if (usingSingularity) {
          // Check if Singularity image exists
          const imageName = command.replace(/^docker\s+pull\s+/i, '')
          const exists = await checkSingularityImageExists(imageName)
          setImageExists(exists)
        }
      } catch (error) {
        console.error('Error checking container service:', error)
      }
    }
    checkContainerService()
  }, [command])

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
    // Only set up terminal for Docker
    if (!isSingularity) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSingularity]) // run when singularity status changes

  const handleButtonPress = async (input: string) => {
    if (isSingularity) {
      // Handle Singularity pull
      setIsPulling(true)
      setPullError(null)
      try {
        const imageName = input.replace(/^docker\s+pull\s+/i, '')
        const result = await pullSingularityImage(imageName)
        if (result.alreadyExists) {
          setImageExists(true)
        } else {
          setImageExists(true)
          setOutput([...output, `Singularity image pulled successfully: ${result.imagePath}`])
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to pull Singularity image'
        setPullError(errorMessage)
        setOutput([...output, `Error: ${errorMessage}`])
      } finally {
        setIsPulling(false)
        setShowTerminal(true)
      }
    } else {
      // Handle Docker pull (original behavior)
      terminalInput(input)
      setShowTerminal(true)
    }
  }

  return (
    <>
      {!imageExists && !showTerminal && !isPulling && (
        <Button
          variant="contained"
          size="small"
          onClick={() => handleButtonPress(command)}
          style={{ backgroundColor: '#0066FF' }}
          disabled={isPulling}
        >
          {isSingularity ? 'Run Singularity Pull' : 'Run Docker Pull'}
        </Button>
      )}
      
      {isPulling && (
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={20} />
          <Typography variant="body2">Pulling Singularity image...</Typography>
        </Box>
      )}
      
      {pullError && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          Error: {pullError}
        </Typography>
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
              {isSingularity ? 'Singularity Image Downloaded' : 'Docker Image Downloaded'}
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
