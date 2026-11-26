import React from 'react'
import Header from './components/Header'
import AppRoutes from './pages/AppRoutes'
import { useUserState } from './contexts/UserStateContext'
import './App.css'
import { AppThemeProvider } from './theme/AppThemeProvider'

const AppContent: React.FC = () => {
  const { username } = useUserState()
  const isLoggedIn = !!username

  return (
    <>
      {isLoggedIn && <Header appUsername={username} />}
      <AppRoutes />
    </>
  )
}

const App: React.FC = () => <AppThemeProvider><AppContent /></AppThemeProvider>

export default App
