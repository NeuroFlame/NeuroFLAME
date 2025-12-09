import { useApolloClients } from '../../contexts/ApolloClientsContext'
import { connectAsUser } from './connectAsUser'
import { getMountDir } from './getMountDir'
import { setMountDir } from './setMountDir'
import { getLocalParams } from './getLocalParams'
import { setLocalParams } from './setLocalParams'

export const useEdgeApi = () => {
  const { edgeClientApolloClient } = useApolloClients()

  if (!edgeClientApolloClient) {
    throw new Error('Apollo Client is not defined')
  }

  return {
    connectAsUser: () => connectAsUser(edgeClientApolloClient),

    // Get the mount directory for a consortium
    getMountDir: (consortiumId: string) =>
      getMountDir(edgeClientApolloClient, consortiumId),

    // Set the mount directory for a consortium
    setMountDir: (consortiumId: string, mountDir: string) =>
      setMountDir(edgeClientApolloClient, consortiumId, mountDir),

     // Get the local parameters for a consortium
    getLocalParams: (consortiumId: string, mountDir: string) =>
      getLocalParams(edgeClientApolloClient, consortiumId, mountDir),

    // Set the local parameters for a consortium
    setLocalParams: (consortiumId: string, mountDir: string, LocalParameters: string) =>
      setLocalParams(edgeClientApolloClient, consortiumId, mountDir, LocalParameters),
  }
}
