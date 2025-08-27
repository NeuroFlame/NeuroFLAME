import React, { useState, useEffect, ReactNode } from 'react'
import { ApolloClient, NormalizedCacheObject } from '@apollo/client'
import { createApolloClient } from '../utils/createApolloClient'
import { ApolloClientsContext } from './ApolloClientsContext' // Ensure this path is correct

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
  },
  [config],
  )

  const startClients = async () => {
    if (centralApiApolloClient) {
      console.log('stopping centralApiApolloClient')
      centralApiApolloClient.stop()
    }

    if (edgeClientApolloClient) {
      console.log('stopping edgeClientApolloClient')
      edgeClientApolloClient.stop()
    }

    console.log('creating centralApiApolloClient', config.centralServerQueryUrl)
    const central = createApolloClient({
      httpUrl: config.centralServerQueryUrl,
      wsUrl: config.centralServerSubscriptionUrl,
      getAccessToken: () => localStorage.getItem('accessToken') || '',
    })
    setCentralApiApolloClient(central)

    const edge = createApolloClient({
      httpUrl: config.edgeClientQueryUrl,
      wsUrl: config.edgeClientSubscriptionUrl,
      getAccessToken: () => localStorage.getItem('accessToken') || '',
    })

    setEdgeClientApolloClient(edge)
  }

  if (!centralApiApolloClient || !edgeClientApolloClient) {
    return <div>Loading...</div>
  }

  return (
    <ApolloClientsContext.Provider value={{ centralApiApolloClient, edgeClientApolloClient }}>
      {children}
    </ApolloClientsContext.Provider>
  )
}

export default ApolloClientsProvider
