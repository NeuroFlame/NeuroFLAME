export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Computation = {
  __typename?: 'Computation';
  imageDownloadUrl: Scalars['String']['output'];
  imageName: Scalars['String']['output'];
  notes: Scalars['String']['output'];
  owner: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type ComputationListItem = {
  __typename?: 'ComputationListItem';
  id: Scalars['String']['output'];
  imageName: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type ConsortiumDetails = {
  __typename?: 'ConsortiumDetails';
  activeMembers: Array<PublicUser>;
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  leader: PublicUser;
  members: Array<PublicUser>;
  readyMembers: Array<PublicUser>;
  studyConfiguration: StudyConfiguration;
  title: Scalars['String']['output'];
};

export type ConsortiumListItem = {
  __typename?: 'ConsortiumListItem';
  description: Scalars['String']['output'];
  id: Scalars['String']['output'];
  leader: PublicUser;
  members: Array<PublicUser>;
  title: Scalars['String']['output'];
};

export type LoginOutput = {
  __typename?: 'LoginOutput';
  accessToken: Scalars['String']['output'];
  roles: Array<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
  username: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  adminChangeUserPassword: Scalars['Boolean']['output'];
  adminChangeUserRoles: Scalars['Boolean']['output'];
  computationCreate: Scalars['Boolean']['output'];
  computationEdit: Scalars['Boolean']['output'];
  consortiumCreate: Scalars['String']['output'];
  consortiumEdit: Scalars['Boolean']['output'];
  consortiumJoin: Scalars['Boolean']['output'];
  consortiumLeave: Scalars['Boolean']['output'];
  consortiumSetMemberActive: Scalars['Boolean']['output'];
  consortiumSetMemberReady: Scalars['Boolean']['output'];
  leaderAddVaultUser: Scalars['Boolean']['output'];
  leaderRemoveMember: Scalars['Boolean']['output'];
  leaderSetMemberInactive: Scalars['Boolean']['output'];
  login: LoginOutput;
  reportRunComplete: Scalars['Boolean']['output'];
  reportRunError: Scalars['Boolean']['output'];
  reportRunReady: Scalars['Boolean']['output'];
  reportRunStatus: Scalars['Boolean']['output'];
  startRun: StartRunOutput;
  studySetComputation: Scalars['Boolean']['output'];
  studySetNotes: Scalars['Boolean']['output'];
  studySetParameters: Scalars['Boolean']['output'];
  userChangePassword: Scalars['Boolean']['output'];
  userCreate: LoginOutput;
};


export type MutationAdminChangeUserPasswordArgs = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};


export type MutationAdminChangeUserRolesArgs = {
  roles: Array<Scalars['String']['input']>;
  username: Scalars['String']['input'];
};


export type MutationComputationCreateArgs = {
  imageDownloadUrl: Scalars['String']['input'];
  imageName: Scalars['String']['input'];
  notes: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationComputationEditArgs = {
  computationId: Scalars['String']['input'];
  imageDownloadUrl: Scalars['String']['input'];
  imageName: Scalars['String']['input'];
  notes: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationConsortiumCreateArgs = {
  description: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationConsortiumEditArgs = {
  consortiumId: Scalars['String']['input'];
  description: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationConsortiumJoinArgs = {
  consortiumId: Scalars['String']['input'];
};


export type MutationConsortiumLeaveArgs = {
  consortiumId: Scalars['String']['input'];
};


export type MutationConsortiumSetMemberActiveArgs = {
  active: Scalars['Boolean']['input'];
  consortiumId: Scalars['String']['input'];
};


export type MutationConsortiumSetMemberReadyArgs = {
  consortiumId: Scalars['String']['input'];
  ready: Scalars['Boolean']['input'];
};


export type MutationLeaderAddVaultUserArgs = {
  consortiumId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationLeaderRemoveMemberArgs = {
  consortiumId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationLeaderSetMemberInactiveArgs = {
  consortiumId: Scalars['String']['input'];
  userId: Scalars['String']['input'];
};


export type MutationLoginArgs = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};


export type MutationReportRunCompleteArgs = {
  runId: Scalars['String']['input'];
};


export type MutationReportRunErrorArgs = {
  errorMessage: Scalars['String']['input'];
  runId: Scalars['String']['input'];
};


export type MutationReportRunReadyArgs = {
  runId: Scalars['String']['input'];
};


export type MutationReportRunStatusArgs = {
  runId: Scalars['String']['input'];
  status: Scalars['String']['input'];
};


export type MutationStartRunArgs = {
  input: StartRunInput;
};


export type MutationStudySetComputationArgs = {
  computationId: Scalars['String']['input'];
  consortiumId: Scalars['String']['input'];
};


export type MutationStudySetNotesArgs = {
  consortiumId: Scalars['String']['input'];
  notes: Scalars['String']['input'];
};


export type MutationStudySetParametersArgs = {
  consortiumId: Scalars['String']['input'];
  parameters: Scalars['String']['input'];
};


export type MutationUserChangePasswordArgs = {
  password: Scalars['String']['input'];
};


export type MutationUserCreateArgs = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type PublicUser = {
  __typename?: 'PublicUser';
  id: Scalars['String']['output'];
  username: Scalars['String']['output'];
  vault?: Maybe<Vault>;
};

export type Query = {
  __typename?: 'Query';
  getComputationDetails: Computation;
  getComputationList: Array<ComputationListItem>;
  getConsortiumDetails: ConsortiumDetails;
  getConsortiumList: Array<ConsortiumListItem>;
  getRunDetails: RunDetails;
  getRunList: Array<RunListItem>;
  getVaultUserList: Array<PublicUser>;
};


export type QueryGetComputationDetailsArgs = {
  computationId: Scalars['String']['input'];
};


export type QueryGetConsortiumDetailsArgs = {
  consortiumId: Scalars['String']['input'];
};


export type QueryGetRunDetailsArgs = {
  runId: Scalars['String']['input'];
};


export type QueryGetRunListArgs = {
  consortiumId?: InputMaybe<Scalars['String']['input']>;
};

export type RunDetails = {
  __typename?: 'RunDetails';
  consortiumId: Scalars['String']['output'];
  consortiumTitle: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  lastUpdated: Scalars['String']['output'];
  members: Array<PublicUser>;
  runErrors: Array<RunError>;
  runId: Scalars['String']['output'];
  status: Scalars['String']['output'];
  studyConfiguration: StudyConfiguration;
};

export type RunError = {
  __typename?: 'RunError';
  message: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
  user: PublicUser;
};

export type RunEventPayload = {
  __typename?: 'RunEventPayload';
  consortiumId: Scalars['String']['output'];
  consortiumTitle: Scalars['String']['output'];
  runId: Scalars['String']['output'];
  status: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
};

export type RunListItem = {
  __typename?: 'RunListItem';
  consortiumId: Scalars['String']['output'];
  consortiumTitle: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  lastUpdated: Scalars['String']['output'];
  runId: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type RunStartCentralPayload = {
  __typename?: 'RunStartCentralPayload';
  computationParameters: Scalars['String']['output'];
  consortiumId: Scalars['String']['output'];
  imageName: Scalars['String']['output'];
  runId: Scalars['String']['output'];
  userIds: Array<Scalars['String']['output']>;
};

export type RunStartEdgePayload = {
  __typename?: 'RunStartEdgePayload';
  consortiumId: Scalars['String']['output'];
  downloadToken: Scalars['String']['output'];
  downloadUrl: Scalars['String']['output'];
  imageName: Scalars['String']['output'];
  runId: Scalars['String']['output'];
};

export type StartRunInput = {
  consortiumId: Scalars['String']['input'];
};

export type StartRunOutput = {
  __typename?: 'StartRunOutput';
  runId: Scalars['String']['output'];
};

export type StudyConfiguration = {
  __typename?: 'StudyConfiguration';
  computation?: Maybe<Computation>;
  computationParameters: Scalars['String']['output'];
  consortiumLeaderNotes: Scalars['String']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  consortiumDetailsChanged: Scalars['String']['output'];
  consortiumLatestRunChanged: Scalars['String']['output'];
  runDetailsChanged: Scalars['String']['output'];
  runEvent: RunEventPayload;
  runStartCentral: RunStartCentralPayload;
  runStartEdge: RunStartEdgePayload;
};


export type SubscriptionConsortiumDetailsChangedArgs = {
  consortiumId: Scalars['String']['input'];
};


export type SubscriptionConsortiumLatestRunChangedArgs = {
  consortiumId: Scalars['String']['input'];
};


export type SubscriptionRunDetailsChangedArgs = {
  runId: Scalars['String']['input'];
};

export type Vault = {
  __typename?: 'Vault';
  description: Scalars['String']['output'];
  name: Scalars['String']['output'];
};
