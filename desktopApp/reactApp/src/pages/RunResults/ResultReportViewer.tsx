import { useEffect } from 'react'
import { useThemePreference } from '../../theme/AppThemeProvider'

export default function ResultReportViewer({ src }: { src: string }) {
  const { mode } = useThemePreference()
  useEffect(() => {
    const sync = window.ElectronAPI?.setResultReportTheme
    if (!sync || !/\.html?$/i.test(new URL(src, window.location.href).pathname)) return
    sync({ url: src, mode }).catch(() => console.warn('Unable to synchronize the result report theme.'))
    return () => {
      sync(null).catch(() => console.warn('Unable to release the result report theme.'))
    }
  }, [src, mode])

  return (
    <iframe
      src={src}
      title='Run Result'
      width='100%'
      height='100%'
      style={{ border: 'none', background: 'white', colorScheme: 'normal', height: 'calc(100vh - 170px)' }}
    />
  )
}
