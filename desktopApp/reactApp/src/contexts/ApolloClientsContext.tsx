import { createContext, useContext } from 'react'
import { ApolloClient, NormalizedCacheObject } from '@apollo/client'

// Define the type for the context state
interface ApolloClientsContextType {
  centralApiApolloClient?: ApolloClient<NormalizedCacheObject>;
  edgeClientApolloClient?: ApolloClient<NormalizedCacheObject>;
}

// Create and export the context
export const ApolloClientsContext = createContext<ApolloClientsContextType>({
  centralApiApolloClient: undefined,
  edgeClientApolloClient: undefined,
})

// Custom hook for using the Apollo clients context
export const useApolloClients = () => useContext(ApolloClientsContext)
