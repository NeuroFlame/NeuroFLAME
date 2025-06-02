export const typeDefs = `type PublicUser {
  id: String!
  username: String!
  vault: Vault
}

type Vault {
  name: String!
  description: String!
}

type ConsortiumListItem {
  id: String!
  title: String!
  description: String!
  leader: PublicUser!
  members: [PublicUser!]!  
}

type ComputationListItem {
  id: String!
  title: String!
  imageName: String!
}

input StartRunInput {
  consortiumId: String!
}

type RunStartCentralPayload {
  runId: String!
  imageName: String!
  userIds: [String!]!  
  consortiumId: String!
  computationParameters: String!
}

type RunStartEdgePayload {
  runId: String!
  imageName: String!
  consortiumId: String!
  downloadUrl: String!
  downloadToken: String!
}

type StartRunOutput {
  runId: String!
}

type Computation {
  title: String!
  imageName: String!
  imageDownloadUrl: String!
  notes: String!
  owner: String!
}

type StudyConfiguration {
  consortiumLeaderNotes: String!
  computationParameters: String!
  computation: Computation
}

type ConsortiumDetails {
  id: String!
  title: String!
  description: String!
  leader: PublicUser!
  members: [PublicUser!]!  
  activeMembers: [PublicUser!]!  
  readyMembers: [PublicUser!]!  
  studyConfiguration: StudyConfiguration!
}

type LoginOutput {
  accessToken: String!
  userId: String!
  username: String!
  roles: [String!]!  
}

type RunEventPayload {
  consortiumId: String!
  consortiumTitle: String!
  runId: String!
  status: String!
  timestamp: String!
}

type RunListItem {
  consortiumId: String!
  consortiumTitle: String!
  runId: String!
  status: String!
  lastUpdated: String!
  createdAt: String!
}

type RunError {
  user: PublicUser!
  timestamp: String!
  message: String!
}

type RunDetails {
  runId: String!
  consortiumId: String!
  consortiumTitle: String!
  status: String!
  lastUpdated: String!
  createdAt: String!
  members: [PublicUser!]!  
  studyConfiguration: StudyConfiguration!
  runErrors: [RunError!]!  
}

type Query {
  getConsortiumList: [ConsortiumListItem!]!  
  getComputationList: [ComputationListItem!]!  
  getConsortiumDetails(consortiumId: String!): ConsortiumDetails!
  getComputationDetails(computationId: String!): Computation!
  getRunList(consortiumId: String): [RunListItem!]!  
  getRunDetails(runId: String!): RunDetails!
  getVaultUserList: [PublicUser!]!  
}

type Mutation {
  # used by federated clients
  reportRunReady(runId: String!): Boolean!
  reportRunError(runId: String!, errorMessage: String!): Boolean!
  reportRunComplete(runId: String!): Boolean!
  reportRunStatus(runId: String!, status: String!): Boolean!
  # used by desktop App
  login(username: String!, password: String!): LoginOutput!
  startRun(input: StartRunInput!): StartRunOutput!
  studySetComputation(consortiumId: String!, computationId: String!): Boolean!
  studySetParameters(consortiumId: String!, parameters: String!): Boolean!
  studySetNotes(consortiumId: String!, notes: String!): Boolean!
  consortiumCreate(title: String!, description: String!): String!
  consortiumEdit(consortiumId: String!, title: String!, description: String!): Boolean!
  consortiumJoin(consortiumId: String!): Boolean!
  consortiumLeave(consortiumId: String!): Boolean!
  consortiumSetMemberActive(consortiumId: String!, active: Boolean!): Boolean!
  consortiumSetMemberReady(consortiumId: String!, ready: Boolean!): Boolean!
  computationCreate(title: String!, imageName: String!, imageDownloadUrl: String!, notes: String!): Boolean!
  computationEdit(computationId: String!, title: String!, imageName: String!, imageDownloadUrl: String!, notes: String!): Boolean!
  userCreate(username: String!, password: String!): LoginOutput!
  userChangePassword(password: String!): Boolean!
  adminChangeUserRoles(username: String!, roles: [String!]!): Boolean!
  adminChangeUserPassword(username: String!, password: String!): Boolean!
  leaderSetMemberInactive(consortiumId: String!, userId: String!): Boolean!
  leaderRemoveMember(consortiumId: String!, userId: String!): Boolean!
  leaderAddVaultUser(consortiumId: String!, userId: String!): Boolean!
}

type Subscription {
  # used by central federated client
  runStartCentral: RunStartCentralPayload!
  # used by edge federated client
  runStartEdge: RunStartEdgePayload!
  # used by desktop App
  runEvent: RunEventPayload!
  consortiumLatestRunChanged(consortiumId: String!): String!
  consortiumDetailsChanged(consortiumId: String!): String!
  runDetailsChanged(runId: String!): String!
}
`;
