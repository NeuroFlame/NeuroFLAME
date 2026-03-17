import { Route, Routes } from 'react-router-dom'

import InvitePage from './pages/Invite'

import Header from './components/Header'

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path='/invite/:inviteToken' element={<InvitePage />} />
      </Routes>
    </>
  )
}
