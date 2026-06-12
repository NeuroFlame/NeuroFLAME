import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { DATABASE_URI } from '../config.js'
import { logger } from '../logger.js'
import Consortium from './models/Consortium.js'
import Computation from './models/Computation.js'
import Run from './models/Run.js'
import User from './models/User.js'
import VaultServer from './models/VaultServer.js'
import HostedVault from './models/HostedVault.js'
// eslint-disable-next-line @stylistic/max-len
import computationNotesSingleRoundRidgeRegressionFreesurfer from './seedContent/computationNotesSingleRoundRidgeRegressionFreesurfer.js'
// eslint-disable-next-line @stylistic/max-len
import computationNotesSingleRoundClosedformRegressionVBM from './seedContent/computationNotesSingleRoundClosedformRegressionVBM.js'
import computationNotesSpatiallyConstrainedICA from './seedContent/computationNotesSpatiallyConstrainedICA.js'
import vaultDescriptionCobreFreeSurfer from './seedContent/vaultDescriptionCobreFreeSurfer.js'

type SeedUser = {
  _id: mongoose.Types.ObjectId
  username: string
  hash: string
  roles?: string[]
  vault?: {
    name: string
    description: string
    allowedComputations: mongoose.Types.ObjectId[]
  }
  resetToken?: string
  resetTokenExpiry?: number
}

type SeedComputation = (typeof computations)[number]

type SeedConsortium = {
  _id: mongoose.Types.ObjectId
  title: string
  description: string
  leader: mongoose.Types.ObjectId
  members: mongoose.Types.ObjectId[]
  activeMembers: mongoose.Types.ObjectId[]
  vaultMembers: mongoose.Types.ObjectId[]
  activeVaultMembers: mongoose.Types.ObjectId[]
  readyVaultMembers: mongoose.Types.ObjectId[]
  studyConfiguration: {
    consortiumLeaderNotes: string
    computationParameters: string
    computation: SeedComputation
  }
}

type SeedRun = {
  _id: mongoose.Types.ObjectId
  consortium: mongoose.Types.ObjectId
  consortiumLeader: mongoose.Types.ObjectId
  studyConfiguration: SeedConsortium['studyConfiguration']
  members: mongoose.Types.ObjectId[]
  vaultMembers: mongoose.Types.ObjectId[]
  status: string
  runErrors: { user: mongoose.Types.ObjectId; timestamp: string; message: string }[]
  createdAt: number
  lastUpdated: number
}

const saltRounds = 10

const isTest = process.env.NODE_ENV === 'test'

// Predefined ObjectIds for relationships and consistency
const predefinedIds = {
  centralUserId: new mongoose.Types.ObjectId('66289c79aebab67040a20067'),
  user1Id: new mongoose.Types.ObjectId('66289c79aebab67040a20068'),
  user2Id: new mongoose.Types.ObjectId('66289c79aebab67040a20069'),
  user3Id: new mongoose.Types.ObjectId('66289c79aebab67040a20070'),
  user4Id: new mongoose.Types.ObjectId('66289c79aebab67040a20071'),
  user5IdVault: new mongoose.Types.ObjectId('66289c79aebab67040a20072'),
  vaultServer1Id: new mongoose.Types.ObjectId('66289c79aebab67040a20073'),
  hostedVault1Id: new mongoose.Types.ObjectId('66289c79aebab67040a20074'),
  hostedVault2Id: new mongoose.Types.ObjectId('66289c79aebab67040a20075'),
  testUser1Id: new mongoose.Types.ObjectId('66289c79aebab67040a20076'),
  testUser2Id: new mongoose.Types.ObjectId('66289c79aebab67040a20077'),
  computation1Id: new mongoose.Types.ObjectId('66289c79aebab67040a21000'),
  computation2Id: new mongoose.Types.ObjectId('66289c79aebab67040a21001'),
  computation3Id: new mongoose.Types.ObjectId('66289c79aebab67040a21002'),
  consortium1Id: new mongoose.Types.ObjectId('66289c79aecab67040a22001'),
  consortium2Id: new mongoose.Types.ObjectId('66289c79aecab67040a22002'),
  run1Id: new mongoose.Types.ObjectId('66289c79aecab67040a23000'),
  run2Id: new mongoose.Types.ObjectId('66289c79aecab67040a23001'),
  run3Id: new mongoose.Types.ObjectId('66289c79aecab67040a23002'),
  run4Id: new mongoose.Types.ObjectId('66289c79aecab67040a23003'),
}

// Define data
const users: SeedUser[] = [
  {
    _id: predefinedIds.user1Id,
    username: 'user1@email.com',
    hash: await bcrypt.hash('password1', saltRounds),
  },
  {
    _id: predefinedIds.user2Id,
    username: 'user2@email.com',
    hash: await bcrypt.hash('password2', saltRounds),
  },
  {
    _id: predefinedIds.user3Id,
    username: 'user3@email.com',
    hash: await bcrypt.hash('password3', saltRounds),
  },
  {
    _id: predefinedIds.user4Id,
    username: 'user4@email.com',
    hash: await bcrypt.hash('password4', saltRounds),
    roles: ['admin'],
  },
  {
    _id: predefinedIds.centralUserId,
    username: 'centralUser@email.com',
    hash: await bcrypt.hash('centralPassword', saltRounds),
    roles: ['central'],
  },
  {
    _id: predefinedIds.user5IdVault,
    username: 'cobrefs@email.com',
    hash: await bcrypt.hash('vaultPassword1', saltRounds),
    roles: ['vault'],
    vault: {
      name: 'TReNDS Cobre FreeSurfer Regression Vault',
      description: vaultDescriptionCobreFreeSurfer,
      allowedComputations: [
        predefinedIds.computation1Id,
        predefinedIds.computation2Id,
      ],
    },
  },
]

const computations = [
  {
    _id: predefinedIds.computation1Id,
    title: 'Single-Round Ridge Regression for FreeSurfer Data',
    imageName: 'coinstacteam/nfc-single-round-ridge-regression-freesurfer',
    imageDownloadUrl: 'docker pull coinstacteam/nfc-single-round-ridge-regression-freesurfer',
    notes: computationNotesSingleRoundRidgeRegressionFreesurfer,
    owner: predefinedIds.user1Id.toString(),
    hasLocalParameters: false,
  },
  {
    _id: predefinedIds.computation2Id,
    title: 'Single Round Closedform Regression VBM',
    imageName: 'coinstacteam/nfc-single-round-closedform-regression-vbm',
    imageDownloadUrl: 'docker pull coinstacteam/nfc-single-round-closedform-regression-vbm',
    notes: computationNotesSingleRoundClosedformRegressionVBM,
    owner: predefinedIds.user1Id.toString(),
    hasLocalParameters: false,
  },
  {
    _id: predefinedIds.computation3Id,
    title: 'Spatially Constrained ICA',
    imageName: 'coinstacteam/nfc-spatially-constrained-ica',
    imageDownloadUrl: 'docker pull coinstacteam/nfc-spatially-constrained-ica',
    notes: computationNotesSpatiallyConstrainedICA,
    owner: predefinedIds.user1Id.toString(),
    hasLocalParameters: true,
  },
]

const consortia: SeedConsortium[] = [
  {
    _id: predefinedIds.consortium1Id,
    title: 'Single Round Ridge Regression Consortium',
    description: 'Test consortium for single round ridge regression',
    leader: predefinedIds.user1Id,
    members: [predefinedIds.user1Id, predefinedIds.user2Id],
    activeMembers: [predefinedIds.user1Id, predefinedIds.user2Id],
    vaultMembers: [predefinedIds.hostedVault1Id],
    activeVaultMembers: [predefinedIds.hostedVault1Id],
    readyVaultMembers: [predefinedIds.hostedVault1Id],
    studyConfiguration: {
      consortiumLeaderNotes: 'Leader notes for single round ridge regression',
      computationParameters: JSON.stringify({
        Dependents: {
          '4th-Ventricle': 'float',
          '5th-Ventricle': 'float',
        },
        Covariates: {
          sex: 'str',
          isControl: 'bool',
          age: 'float',
        },
        Lambda: 1,
        IgnoreSubjectsWithInvalidData: true,
      }),
      computation: computations[0],
    },
  },
]

const vaultServers = [
  {
    _id: predefinedIds.vaultServer1Id,
    user: predefinedIds.user5IdVault,
    name: 'TReNDS Cobre Dataset Server',
    description: 'Development dataset server for hosted vault testing.',
  },
]

const hostedVaults = [
  {
    _id: predefinedIds.hostedVault1Id,
    server: predefinedIds.vaultServer1Id,
    name: 'TReNDS Cobre FreeSurfer Site 1 Vault',
    description: vaultDescriptionCobreFreeSurfer,
    datasetKey: 'freesurfer-site1',
    allowedComputations: [
      predefinedIds.computation1Id,
      predefinedIds.computation2Id,
    ],
    active: true,
  },
  {
    _id: predefinedIds.hostedVault2Id,
    server: predefinedIds.vaultServer1Id,
    name: 'TReNDS Cobre VBM Vault',
    description: 'Hosted VBM dataset vault on the shared dataset server.',
    datasetKey: 'vbm-data',
    allowedComputations: [
      predefinedIds.computation2Id,
    ],
    active: true,
  },
]

const runs: SeedRun[] = [
  {
    _id: predefinedIds.run1Id,
    consortium: predefinedIds.consortium1Id,
    consortiumLeader: predefinedIds.user1Id,
    studyConfiguration: consortia[0].studyConfiguration,
    members: consortia[0].members,
    vaultMembers: consortia[0].vaultMembers,
    status: 'Pending',
    runErrors: [],
    createdAt: new Date().setUTCFullYear(2023),
    lastUpdated: new Date().setUTCFullYear(2023),
  },
]

if (isTest) {
  users.push({
    _id: predefinedIds.testUser1Id,
    username: 'e2e-test-user-1@email.com',
    hash: await bcrypt.hash('password', saltRounds),
    resetToken: 'reset-token',
    resetTokenExpiry: Date.now() + 1000 * 60 * 60 * 24,
  })

  users.push({
    _id: predefinedIds.testUser2Id,
    username: 'e2e-test-user-2@email.com',
    hash: await bcrypt.hash('password', saltRounds),
  })

  consortia.push({
    _id: predefinedIds.consortium2Id,
    title: 'Single Round Closedform Regression VBM',
    description: 'Test consortium for single round closedform regression VBM',
    leader: predefinedIds.user1Id,
    members: [predefinedIds.user1Id, predefinedIds.user2Id],
    activeMembers: [predefinedIds.user1Id, predefinedIds.user2Id],
    vaultMembers: [],
    activeVaultMembers: [],
    readyVaultMembers: [],
    studyConfiguration: {
      consortiumLeaderNotes: 'Leader notes for single round closedform regression VBM',
      computationParameters: JSON.stringify({
        Covariates: {
          sex: 'str',
          isControl: 'bool',
          age: 'float',
        },
        Lambda: 1,
        Threshold: 0.2,
        VoxelSize: 4,
        ReferenceColumns: { site: 'IA' },
        IgnoreSubjectsWithMissingData: false,
      }),
      computation: computations[1],
    },
  })

  runs.push(...[
    {
      _id: predefinedIds.run2Id,
      consortium: predefinedIds.consortium1Id,
      consortiumLeader: predefinedIds.user1Id,
      studyConfiguration: consortia[0].studyConfiguration,
      members: consortia[0].members,
      vaultMembers: consortia[0].vaultMembers,
      status: 'Complete',
      runErrors: [],
      createdAt: new Date().setUTCFullYear(2024),
      lastUpdated: new Date().setUTCFullYear(2024),
    },
    {
      _id: predefinedIds.run3Id,
      consortium: predefinedIds.consortium2Id,
      consortiumLeader: predefinedIds.user1Id,
      studyConfiguration: consortia[1].studyConfiguration,
      members: consortia[1].members,
      vaultMembers: [],
      status: 'Running',
      runErrors: [],
      createdAt: new Date().setUTCFullYear(2025),
      lastUpdated: new Date().setUTCFullYear(2025),
    },
    {
      _id: predefinedIds.run4Id,
      consortium: predefinedIds.consortium2Id,
      consortiumLeader: predefinedIds.user1Id,
      studyConfiguration: consortia[1].studyConfiguration,
      members: consortia[1].members,
      vaultMembers: [],
      status: 'Failed',
      runErrors: [],
      createdAt: new Date().setUTCFullYear(2026),
      lastUpdated: new Date().setUTCFullYear(2026),
    },
  ])
}

// Seeding Function
const seedDatabase = async () => {
  try {
    await mongoose.connect(DATABASE_URI, { authSource: 'admin' })
    logger.info('MongoDB connected successfully.')

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      VaultServer.deleteMany({}),
      HostedVault.deleteMany({}),
      Consortium.deleteMany({}),
      Computation.deleteMany({}),
      Run.deleteMany({}),
    ])

    // Insert seed data
    await User.insertMany(users)
    logger.info('Users seeded successfully!')

    await Computation.insertMany(computations)
    logger.info('Computations seeded successfully!')

    await VaultServer.insertMany(vaultServers)
    logger.info('Vault servers seeded successfully!')

    await HostedVault.insertMany(hostedVaults)
    logger.info('Hosted vaults seeded successfully!')

    await Consortium.insertMany(consortia)
    logger.info('Consortia seeded successfully!')

    if (isTest) {
      await Run.insertMany(runs)
      logger.info('Runs seeded successfully!')
    }
  } catch (error) {
    logger.error('Failed to seed database:', error)
  } finally {
    await mongoose.connection.close()
  }
}

seedDatabase()
