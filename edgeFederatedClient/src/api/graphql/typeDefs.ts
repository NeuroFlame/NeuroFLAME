export const typeDefs = `
  type Query {
    getMountDir(consortiumId: String): String
  }

  type Mutation {
    connectAsUser: String
    setMountDir(consortiumId: String, mountDir: String): Boolean
  }
`
