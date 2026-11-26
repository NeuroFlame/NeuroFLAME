import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CssBaseline, GlobalStyles, ThemeProvider, createTheme, useMediaQuery } from '@mui/material'

export type ThemePreference = 'light' | 'dark' | 'system'
export const THEME_STORAGE_KEY = 'neuroflame.theme'
const ThemePreferenceContext = createContext<{
  mode: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
} | null>(null)

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // A restricted storage environment still supports an in-memory preference.
    console.warn('Theme preference storage is unavailable.')
  }
  return 'light'
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preference, updatePreference] = useState<ThemePreference>(readPreference)
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const mode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      contrastThreshold: 4.5,
      primary: { main: mode === 'dark' ? '#528fff' : '#0057d9' },
      secondary: { main: mode === 'dark' ? '#ef529c' : '#b91372' },
      background: { default: mode === 'dark' ? '#0b1428' : '#efeff0', paper: mode === 'dark' ? '#13213b' : '#ffffff' },
      text: { primary: mode === 'dark' ? '#e6ebf4' : '#202a3a', secondary: mode === 'dark' ? '#a9b7ce' : '#536175' },
      divider: mode === 'dark' ? '#354866' : '#ccd3dd',
      success: { main: mode === 'dark' ? '#35c58b' : '#23783c' },
      error: { main: mode === 'dark' ? '#ff626d' : '#b32632' },
      warning: { main: mode === 'dark' ? '#f5ae36' : '#8a5700' },
    },
    typography: { fontFamily: 'Inter, Arial, sans-serif' },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: mode === 'dark' ? '#101d3b' : '#001f70',
            color: '#ffffff',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          containedPrimary: mode === 'dark' ? {
            backgroundColor: '#245fd6',
            color: '#ffffff',
            '&:hover': { backgroundColor: '#2d6be3' },
          } : {},
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiTableCell: { styleOverrides: { head: { backgroundColor: mode === 'dark' ? '#1a2b49' : '#eef2f6' } } },
      MuiTooltip: { defaultProps: { arrow: true } },
    },
  }), [mode])

  const setPreference = (next: ThemePreference) => {
    updatePreference(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      console.warn('Theme preference could not be saved.')
    }
  }

  useEffect(() => {
    // Electron applies these same palette colors only to the hosted home iframe.
    window.ElectronAPI?.setLandingPageTheme?.({
      mode,
      page: theme.palette.background.default,
      surface: theme.palette.background.paper,
      text: theme.palette.text.primary,
      muted: theme.palette.text.secondary,
      border: theme.palette.divider,
      primary: theme.palette.primary.main,
      error: theme.palette.error.main,
      warning: theme.palette.warning.main,
    }).catch(() => console.warn('Unable to update the home iframe theme.'))
  }, [mode, theme])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) updatePreference(readPreference())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <ThemePreferenceContext.Provider value={{ mode, preference, setPreference }}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {/* These tokens also serve native elements and inline styles outside MUI. */}
        <GlobalStyles styles={{
          ':root': {
            '--nf-page': theme.palette.background.default,
            '--nf-surface': theme.palette.background.paper,
            '--nf-subtle': mode === 'dark' ? '#1a2b49' : '#eef2f6',
            '--nf-text': theme.palette.text.primary,
            '--nf-muted': theme.palette.text.secondary,
            '--nf-border': theme.palette.divider,
            '--nf-heading': mode === 'dark' ? theme.palette.text.primary : theme.palette.primary.main,
            '--nf-primary': theme.palette.primary.main,
            '--nf-on-primary': theme.palette.primary.contrastText,
            '--nf-success': theme.palette.success.main,
            '--nf-on-success': theme.palette.success.contrastText,
            '--nf-on-muted': theme.palette.getContrastText(theme.palette.text.secondary),
            '--nf-error': theme.palette.error.main,
            '--nf-error-bg': mode === 'dark' ? '#321d32' : '#fff1f2',
            '--nf-success-bg': mode === 'dark' ? '#12352f' : '#e9f7ee',
            '--nf-brand': mode === 'dark' ? '#101d3b' : '#001f70',
          },
        }}
        />
        {children}
      </ThemeProvider>
    </ThemePreferenceContext.Provider>
  )
}

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext)
  if (!value) throw new Error('Theme controls require AppThemeProvider')
  return value
}
