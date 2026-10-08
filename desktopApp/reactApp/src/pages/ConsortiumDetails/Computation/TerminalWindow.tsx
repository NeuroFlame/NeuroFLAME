import React, { useState, useEffect, useRef, forwardRef } from 'react'
import { electronApi } from '../../../apis/electronApi/electronApi'
import ScrollToBottom from 'react-scroll-to-bottom'
import { Box, Button, Typography, CircularProgress } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { createDockerImageDetector } from './dockerImageOutput'

const ScrollToBottomWrapper = forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof ScrollToBottom>
>((props, ref) => <ScrollToBottom {...props} />)

const TerminalWindow: React.FC<{
  command: string;
  showInstructions?: boolean;
  onImageExists?: (exists: boolean) => void;
}> = ({ command, showInstructions, onImageExists }) => {
  const [output, setOutput] = useState<string[]>([])
  const [isTerminalReady, setTerminalReady] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [imageExists, setImageExists] = useState(false)
  const [isSingularity, setIsSingularity] = useState<boolean | null>(null)
  const [isPulling, setIsPulling] = useState(false)
  const [pullError, setPullError] = useState<string | null>(null)

  useEffect(() => {
    onImageExists?.(imageExists)
  }, [imageExists, onImageExists])

  useEffect(() => {
    setImageExists(false)
    setTerminalReady(false)
    setIsSingularity(null)
    setOutput([])
    setShowTerminal(false)
    setPullError(null)
  }, [command])

  const {
    spawnTerminal,
    terminalInput,
    terminalOutput,
    removeTerminalOutputListener,
    getConfig,
    checkSingularityImageExists,
    pullSingularityImage,
    singularityPullOutput,
    removeSingularityPullOutputListener,
  } = electronApi

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Check if using Singularity
  useEffect(() => {
    let active = true
    const checkContainerService = async () => {
      try {
        const config = await getConfig()
        if (!active) return
        const usingSingularity = config?.edgeClientConfig?.containerService === 'singularity'
        setIsSingularity(usingSingularity || false)

        if (usingSingularity) {
          // Check if Singularity image exists
          const imageName = command.replace(/^docker\s+pull\s+/i, '')
          const exists = await checkSingularityImageExists(imageName)
          if (active) setImageExists(exists)
        }
      } catch (error) {
        console.error('Error checking container service:', error)
        if (active) setPullError('Unable to check the container service. Reload this step to retry.')
      }
    }
    checkContainerService()
    return () => { active = false }
  }, [command])

  useEffect(() => {
    // Only set up terminal for Docker
    if (isSingularity === false) {
      let active = true
      const imageName = command.replace(/^docker\s+pull\s+/i, '')
      const detectImage = createDockerImageDetector(imageName)
      terminalOutput((chunk) => {
        if (!active) return
        if (detectImage(chunk)) setImageExists(true)
        setOutput((prev) => [...prev, chunk])
        queueMicrotask(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
      })

      // Await the IPC acknowledgement before sending the probe or allowing a pull.
      // A fresh terminal also separates output when the selected image changes.
      spawnTerminal().then(() => {
        if (!active) return
        setTerminalReady(true)
        terminalInput(`docker image inspect ${imageName}`)
      }).catch((error) => {
        console.error('Error starting Docker terminal:', error)
        if (active) setPullError('Unable to start the Docker terminal. Reload this step to retry.')
      })

      return () => {
        active = false
        removeTerminalOutputListener()
      }
    }
  }, [isSingularity, command]) // rerun when the selected image changes

  // Set up Singularity pull output listener when Singularity mode is active
  useEffect(() => {
    if (isSingularity) {
      const handleSingularityOutput = (_event: any, data: string) => {
        setOutput((prev) => {
          const lines = data.split('\n').filter((line) => line.trim() || line === '')
          const next = [...prev, ...lines]
          queueMicrotask(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
          return next
        })
      }

      singularityPullOutput(handleSingularityOutput)

      return () => {
        removeSingularityPullOutputListener()
      }
    }
  }, [isSingularity])

  const handleButtonPress = async (input: string) => {
    if (isSingularity) {
      // Handle Singularity pull
      setOutput([]) // Clear previous output
      setShowTerminal(true) // Show output area immediately
      setIsPulling(true)
      setPullError(null)
      try {
        const imageName = input.replace(/^docker\s+pull\s+/i, '')
        // Output will be streamed via singularityPullOutput listener
        const result = await pullSingularityImage(imageName)
        if (result.alreadyExists) {
          setImageExists(true)
          setOutput((prev) => [...prev, 'Singularity image already exists.'])
        } else {
          setImageExists(true)
          setOutput((prev) => [...prev, `\nSingularity image pulled successfully: ${result.imagePath}`])
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to pull Singularity image'
        setPullError(errorMessage)
        setOutput((prev) => [...prev, `\nError: ${errorMessage}`])
      } finally {
        setIsPulling(false)
      }
    } else {
      if (!isTerminalReady) return
      terminalInput(input)
      setShowTerminal(true)
    }
  }

  return (
    <>
      {showInstructions && !imageExists && !showTerminal && !isPulling && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 1 }}>
          <Box>
            <Typography variant='body2' fontWeight='bold' color='error'>
              {isSingularity
                ? 'Click "Run Singularity Pull" below to download the computation image.'
                : 'Click "Run Docker Pull" below to download the computation image.'}
            </Typography>
            {!isSingularity && (
              <Typography variant='body2' color='text.secondary'>
                You'll need Docker installed on your machine for this to work.
              </Typography>
            )}
          </Box>
        </Box>
      )}
      {!imageExists && !showTerminal && !isPulling && (
        <Button
          variant='contained'
          size='small'
          onClick={() => handleButtonPress(command)}
          style={{ backgroundColor: '#0066FF' }}
          disabled={isPulling || isSingularity === null || (!isSingularity && !isTerminalReady)}
        >
          {isSingularity ? 'Run Singularity Pull' : 'Run Docker Pull'}
        </Button>
      )}

      {isPulling && (
        <Box display='flex' alignItems='center' gap={1} sx={{ mb: 1 }}>
          <CircularProgress size={20} />
          <Typography variant='body2'>Pulling Singularity image...</Typography>
        </Box>
      )}

      {pullError && (
        <Typography variant='body2' color='error' sx={{ mt: 1 }}>
          Error: {pullError}
        </Typography>
      )}

      {(showTerminal || isPulling) && (
        <ScrollToBottomWrapper className='terminalWindow'>
          {output.map((item, index) => (
            <div key={index} style={{ whiteSpace: 'nowrap' }}>
              &gt; {item}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollToBottomWrapper>
      )}

      <Box display='flex' justifyContent='space-between' alignContent='center'>
        {imageExists && (
          <Box display='flex' justifyContent='flex-start' alignContent='center'>
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
          <Button size='small' onClick={() => setShowTerminal(false)}>
            Hide Terminal
          </Button>
        )}
      </Box>
    </>
  )
}

export default TerminalWindow
