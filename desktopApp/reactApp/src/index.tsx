import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/700.css'
import '@fontsource/lato/300.css'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import './index.css'
import { electronApi } from './apis/electronApi/electronApi'
import ApolloClientsProvider from './contexts/ApolloClientsProvider'
import { HashRouter as Router } from 'react-router-dom'
import { UserStateProvider } from './contexts/UserStateContext'
import interceptExternalLinks from './utils/interceptExternalLinks'

const startApp = async () => {
  console.log('Starting app...')

  interceptExternalLinks()

  // Attempt to get the configuration
  const config = await electronApi.getConfig()
  console.log('Config loaded:', config)

  // Check if the root element exists
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    console.error('Root element not found. Aborting app startup.')
    return
  }
  if (!config) {
    console.error('Config not found. Aborting app startup.')
    return
  }

  const root = ReactDOM.createRoot(rootElement)

  // Render the app, even if config is null (if config is essential, consider a loading screen)
  root.render(
    <ApolloClientsProvider config={config}>
      <UserStateProvider>
        <Router>
          <App />
        </Router>
      </UserStateProvider>
    </ApolloClientsProvider>,
  )
}

startApp().catch((error) => {
  console.error('Error starting the app:', error)
})
