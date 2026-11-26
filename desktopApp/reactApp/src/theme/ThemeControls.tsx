import { Box, IconButton, Tooltip } from '@mui/material'
import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import BrightnessAuto from '@mui/icons-material/BrightnessAuto'
import { useThemePreference } from './AppThemeProvider'

export default function ThemeControls() {
  const { mode, preference, setPreference } = useThemePreference()
  const label = `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Tooltip title={label}>
        <IconButton
          color='inherit'
          aria-label='Dark mode'
          aria-pressed={mode === 'dark'}
          onClick={() => setPreference(mode === 'dark' ? 'light' : 'dark')}
        >
          {mode === 'dark' ? <LightMode /> : <DarkMode />}
        </IconButton>
      </Tooltip>
      <Tooltip title={preference === 'system' ? 'Following system theme' : 'Use system theme'}>
        <IconButton
          color='inherit'
          aria-label='Use system theme'
          aria-pressed={preference === 'system'}
          onClick={() => setPreference('system')}
        >
          <BrightnessAuto />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
