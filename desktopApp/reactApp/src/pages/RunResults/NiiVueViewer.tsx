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
  Switch,
  FormControlLabel,
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

  // Threshold state — dataMin/dataMax are the volume's actual range (set after load)
  const [dataMin, setDataMin] = useState(0)
  const [dataMax, setDataMax] = useState(1)
  const [calMin, setCalMin] = useState(0)
  const [calMax, setCalMax] = useState(1)
  const [thresholdEnabled, setThresholdEnabled] = useState(false)
  const [colormapType, setColormapType] = useState(0)

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
        const filename = fileUrl.split('/').pop()?.split('?')[0] ?? 'volume.nii'
        const file = new File([blob], filename)
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

        // Initialise threshold sliders from the volume's actual calibration range
        const vMin = volume.cal_min ?? 0
        const vMax = volume.cal_max ?? 1
        setDataMin(vMin)
        setDataMax(vMax)
        setCalMin(vMin)
        setCalMax(vMax)
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

  // Apply threshold changes
  useEffect(() => {
    const nv = nvRef.current
    if (!nv || nv.volumes.length === 0) return
    const volume = nv.volumes[0]
    if (thresholdEnabled) {
      volume.cal_min = calMin
      volume.cal_max = calMax
      volume.colormapType = colormapType
    } else {
      volume.cal_min = dataMin
      volume.cal_max = dataMax
      volume.colormapType = 0
    }
    nv.updateGLVolume()
  }, [calMin, calMax, thresholdEnabled, colormapType, dataMin, dataMax])

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

  const handleThresholdChange = (_: any, value: number | number[]) => {
    if (!Array.isArray(value)) return
    setCalMin(value[0])
    setCalMax(value[1])
  }

  const handleReset = () => {
    handleOpacityChange(null, 1)
    handleGammaChange(null, 1)
    handleTimeChange(null, 0)
    setColormap('jet')
    setPlaying(false)
    setThresholdEnabled(false)
    setCalMin(dataMin)
    setCalMax(dataMax)
    setColormapType(0)
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: 'calc(100vh - 170px)',
        backgroundColor: 'black',
      }}
    >
      <Box sx={{ padding: 2, backgroundColor: '#f5f5f5' }}>
        <Grid container spacing={2} alignItems='center'>
          <Grid item>
            <Button variant='outlined' onClick={handleReset}>Reset</Button>
          </Grid>

          <Grid item>
            <Typography>Contrast: {Math.round((gamma / 2) * 100)}%</Typography>
          </Grid>

          <Grid item xs>
            <Slider
              min={0}
              max={2}
              step={0.01}
              value={gamma}
              onChange={handleGammaChange}
            />
          </Grid>

          <Grid item>
            <Typography>
              Brightness: {Math.round((opacity / 2) * 100)}%
            </Typography>
          </Grid>

          <Grid item xs>
            <Slider
              min={0}
              max={2}
              step={0.01}
              value={opacity}
              onChange={handleOpacityChange}
            />
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
                <Button
                  variant='contained'
                  color='success'
                  onClick={() => setPlaying(!playing)}
                >
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

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={thresholdEnabled}
                  onChange={(e) => setThresholdEnabled(e.target.checked)}
                  size='small'
                />
              }
              label='Threshold'
            />
          </Grid>

          {thresholdEnabled && (
            <>
              <Grid item xs={12}>
                <Typography gutterBottom>
                  Threshold: {calMin.toFixed(3)} – {calMax.toFixed(3)}
                </Typography>
                <Slider
                  min={dataMin}
                  max={dataMax}
                  step={(dataMax - dataMin) / 1000}
                  value={[calMin, calMax]}
                  onChange={handleThresholdChange}
                  disableSwap
                />
              </Grid>

              <Grid item xs={12} sm='auto'>
                <FormControl size='small'>
                  <InputLabel>Alpha Mode</InputLabel>
                  <Select
                    value={colormapType}
                    label='Alpha Mode'
                    onChange={(e) => setColormapType(Number(e.target.value))}
                  >
                    <MenuItem value={0}>Restrict to range</MenuItem>
                    <MenuItem value={1}>Transparent sub-threshold</MenuItem>
                    <MenuItem value={2}>Translucent sub-threshold</MenuItem>
                  </Select>
                </FormControl>
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
