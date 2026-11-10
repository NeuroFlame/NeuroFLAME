export const typeDefs = `
  type Query {
    getMountDir(consortiumId: String): String
    getLocalParams(consortiumId: String, mountDir: String): String
    singularityImageCached(imageName: String!): Boolean!
  }

  type Mutation {
    connectAsUser: String
    setMountDir(consortiumId: String, mountDir: String): Boolean
    setLocalParams(consortiumId: String, mountDir: String, localParams: String): Boolean
    pullSingularityImage(imageName: String!): Boolean!
  }
`
