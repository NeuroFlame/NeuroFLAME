import React, { useState, useEffect, ReactNode } from 'react'
import { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import { createApolloClient } from '../utils/createApolloClient'
import { ApolloClientsContext } from './ApolloClientsContext' // Ensure this path is correct
import { connectAsUser } from '../apis/edgeApi/connectAsUser'

interface Props {
  config: {
    centralServerQueryUrl: string;
    centralServerSubscriptionUrl: string;
    edgeClientQueryUrl: string;
    edgeClientSubscriptionUrl: string;
  }
  children: ReactNode
}

const ApolloClientsProvider: React.FC<Props> = ({ children, config }) => {
  const [centralApiApolloClient, setCentralApiApolloClient] = useState<
    ApolloClient<NormalizedCacheObject>
  >()
  const [edgeClientApolloClient, setEdgeClientApolloClient] = useState<
    ApolloClient<NormalizedCacheObject>
  >()

  useEffect(() => {
    startClients()
  }, [config])

  const startClients = async () => {
    if (centralApiApolloClient) {
      console.log('stopping centralApiApolloClient')
      centralApiApolloClient.stop()
    }

    if (edgeClientApolloClient) {
      console.log('stopping edgeClientApolloClient')
      edgeClientApolloClient.stop()
    }

    const getAccessToken = () =>
      sessionStorage.getItem('accessToken') ||
      localStorage.getItem('accessToken') ||
      ''

    console.log('creating centralApiApolloClient', config.centralServerQueryUrl)
    const central = createApolloClient({
      httpUrl: config.centralServerQueryUrl,
      wsUrl: config.centralServerSubscriptionUrl,
      getAccessToken,
    })
    setCentralApiApolloClient(central)

    const edge = createApolloClient({
      httpUrl: config.edgeClientQueryUrl,
      wsUrl: config.edgeClientSubscriptionUrl,
      getAccessToken,
    })

    setEdgeClientApolloClient(edge)

    // The desktop app can restart after an update while retaining its login.
    // Reconnect the freshly started edge daemon so it does not miss run-start
    // events merely because the user did not pass through the login screen.
    if (getAccessToken()) {
      try {
        await connectAsUser(edge)
      } catch (error) {
        console.error('Failed to restore the edge computation subscription', error)
      }
    }
  }

  if (!centralApiApolloClient || !edgeClientApolloClient) {
    return <div>Loading...</div>
  }

  return (
    <ApolloClientsContext.Provider
      value={{ centralApiApolloClient, edgeClientApolloClient }}
    >
      {children}
    </ApolloClientsContext.Provider>
  )
}

export default ApolloClientsProvider
