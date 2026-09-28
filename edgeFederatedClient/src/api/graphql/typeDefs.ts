export const typeDefs = `
  type Query {
    getMountDir(consortiumId: String): String
    getLocalParams(consortiumId: String, mountDir: String): String
    getContainerService: String
  }

  type Mutation {
    connectAsUser: String
    setMountDir(consortiumId: String, mountDir: String): Boolean
    setLocalParams(consortiumId: String, mountDir: String, localParams: String): Boolean
    setContainerService(containerService: String!): Boolean
  }
`
