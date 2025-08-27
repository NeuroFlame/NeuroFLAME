import React from 'react'
import Header from './components/Header'
import AppRoutes from './pages/AppRoutes'
import { useUserState } from './contexts/UserStateContext'
import './App.css'

const App: React.FC = () => {
  const { username } = useUserState()
  const isLoggedIn = !!username

  return (
    <>
      {isLoggedIn && <Header appUsername={username} />}
      <AppRoutes />
    </>
  )
}

export default App
