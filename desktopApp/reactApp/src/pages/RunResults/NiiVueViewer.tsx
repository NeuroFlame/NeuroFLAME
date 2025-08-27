import { useEffect, useRef, useState } from 'react'
import { Niivue } from '@niivue/niivue'
import {
  Box,
  Button,
  Slider,
  Grid,
  Typography,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from '@mui/material'

interface NiiVueViewerProps {
  fileUrl: string;
}

export default function NiiVueViewer({ fileUrl }: NiiVueViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nvRef = useRef<Niivue | null>(null)

  const [opacity, setOpacity] = useState(1)
  const [gamma, setGamma] = useState(1)
  const [numFrames, setNumFrames] = useState(1)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [voxelValue, setVoxelValue] = useState<number | null>(null)
  const [colormap, setColormap] = useState<'jet' | 'hot' | 'plasma' | 'gray'>('jet')

  // Animate timecourse
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (playing && numFrames > 1) {
      interval = setInterval(() => {
        setCurrentFrame((prev) => {
          const next = (prev + 1) % numFrames
          const nv = nvRef.current
          if (nv && nv.volumes.length > 0) {
            nv.setFrame4D(nv.volumes[0].id, next)
          }
          return next
        })
      }, 200)
    }
    return () => clearInterval(interval)
  }, [playing, numFrames])

  // Load file
  useEffect(() => {
    if (!canvasRef.current || !fileUrl) return

    const nv = new Niivue({ show3Dcrosshair: true })
    nvRef.current = nv

    nv.attachToCanvas(canvasRef.current)
    nv.setRadiologicalConvention(false)

    nv.onLocationChange = (data: any) => {
      const val = data?.values?.[0]
      if (typeof val === 'number') {
        setVoxelValue(val)
      } else {
        setVoxelValue(null)
      }
    }

    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
        return res.blob()
      })
      .then(async (blob) => {
        const file = new File([blob], 'volume.nii.gz')
        await nv.loadFromFile(file)

        const volume = nv.volumes[0]
        volume.opacity = opacity
        volume.colormap = colormap
        nv.setGamma(gamma)
        nv.updateGLVolume()

        const frames = volume.nFrame4D ?? 1
        setNumFrames(frames)
        setCurrentFrame(0)
        nv.setFrame4D(volume.id, 0)
      })
      .catch((err) => {
        console.error('❌ NiiVue load error:', err)
      })

    return () => {
      nvRef.current = null
    }
  }, [fileUrl])

  // Apply new colormap
  useEffect(() => {
    const nv = nvRef.current
    if (nv && nv.volumes.length > 0) {
      nv.volumes[0].colormap = colormap
      nv.updateGLVolume()
    }
  }, [colormap])

  const handleOpacityChange = (_: any, value: number | number[]) => {
    const newValue = Array.isArray(value) ? value[0] : value
    setOpacity(newValue)
    const nv = nvRef.current
    if (nv && nv.volumes.length > 0) {
      nv.volumes[0].opacity = newValue
      nv.updateGLVolume()
    }
  }

  const handleGammaChange = (_: any, value: number | number[]) => {
    const newValue = Array.isArray(value) ? value[0] : value
    setGamma(newValue)
    const nv = nvRef.current
    if (nv && nv.volumes.length > 0) {
      nv.setGamma(newValue)
      nv.updateGLVolume()
    }
  }

  const handleTimeChange = (_: any, value: number | number[]) => {
    const newValue = Array.isArray(value) ? value[0] : value
    setCurrentFrame(newValue)
    const nv = nvRef.current
    if (nv && nv.volumes.length > 0) {
      nv.setFrame4D(nv.volumes[0].id, newValue)
      nv.updateGLVolume()
    }
  }

  const handleReset = () => {
    handleOpacityChange(null, 1)
    handleGammaChange(null, 1)
    handleTimeChange(null, 0)
    setColormap('jet')
    setPlaying(false)
  }

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 170px)', backgroundColor: 'black' }}>
      <Box sx={{ padding: 2, backgroundColor: '#f5f5f5' }}>
        <Grid container spacing={2} alignItems='center'>
          <Grid item>
            <Button variant='outlined' onClick={handleReset}>Reset</Button>
          </Grid>

          <Grid item>
            <Typography>Contrast: {Math.round((gamma / 2) * 100)}%</Typography>
          </Grid>

          <Grid item xs>
            <Slider min={0} max={2} step={0.01} value={gamma} onChange={handleGammaChange} />
          </Grid>

          <Grid item>
            <Typography>Brightness: {Math.round((opacity / 2) * 100)}%</Typography>
          </Grid>

          <Grid item xs>
            <Slider min={0} max={2} step={0.01} value={opacity} onChange={handleOpacityChange} />
          </Grid>

          <Grid item xs={12} sm='auto'>
            <FormControl size='small'>
              <InputLabel>Colormap</InputLabel>
              <Select
                value={colormap}
                label='Colormap'
                onChange={(e) => setColormap(e.target.value as typeof colormap)}
              >
                <MenuItem value='gray'>Gray</MenuItem>
                <MenuItem value='hot'>Hot</MenuItem>
                <MenuItem value='jet'>Jet</MenuItem>
                <MenuItem value='plasma'>Plasma</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {numFrames > 1 && (
            <>
              <Grid item>
                <Button variant='contained' color='success' onClick={() => setPlaying(!playing)}>
                  {playing ? 'Pause' : 'Play'}
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Typography>
                  4th Dimension: {currentFrame + 1} / {numFrames}
                </Typography>
                <Slider
                  min={0}
                  max={numFrames - 1}
                  step={1}
                  value={currentFrame}
                  onChange={handleTimeChange}
                />
              </Grid>
            </>
          )}

          {voxelValue !== null && typeof voxelValue === 'number' && (
            <Grid item xs={12}>
              <Typography>
                Voxel Value: {voxelValue.toFixed(4)}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Box>
      <canvas ref={canvasRef} />
    </Box>
  )
}
