import { useApolloClients } from '../../contexts/ApolloClientsContext'
import { connectAsUser } from './connectAsUser'
import { getMountDir } from './getMountDir'
import { setMountDir } from './setMountDir'

export const useEdgeApi = () => {
  const { edgeClientApolloClient } = useApolloClients()

  if (!edgeClientApolloClient) {
    throw new Error('Apollo Client is not defined')
  }

  return {
    connectAsUser: () => connectAsUser(edgeClientApolloClient),

    // Get the mount directory for a consortium
    getMountDir: (consortiumId: string) => getMountDir(edgeClientApolloClient, consortiumId),

    // Set the mount directory for a consortium
    setMountDir: (consortiumId: string, mountDir: string) => setMountDir(edgeClientApolloClient, consortiumId, mountDir),
  }
}
