import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import getConfig from '../config/getConfig.js'
import { logger } from '../logger.js'
import Consortium from './models/Consortium.js'
import Computation from './models/Computation.js'
import Run from './models/Run.js'
import User, { IVault } from './models/User.js'
import computationNotesSingleRoundRidgeRegressionFreesurfer from './seedContent/computationNotesSingleRoundRidgeRegressionFreesurfer.js'

const { databaseDetails } = await getConfig()
const { url, user, pass } = databaseDetails
const saltRounds = 10

// Predefined ObjectIds for relationships and consistency
const predefinedIds = {
  centralUserId: new mongoose.Types.ObjectId('66289c79aebab67040a20067'),
  user1Id: new mongoose.Types.ObjectId('66289c79aebab67040a20068'),
  user2Id: new mongoose.Types.ObjectId('66289c79aebab67040a20069'),
  user3Id: new mongoose.Types.ObjectId('66289c79aebab67040a20070'),
  user4Id: new mongoose.Types.ObjectId('66289c79aebab67040a20071'),
  user5IdVault: new mongoose.Types.ObjectId('66289c79aebab67040a20072'),
  computation1Id: new mongoose.Types.ObjectId('66289c79aebab67040a21000'),
  consortium1Id: new mongoose.Types.ObjectId('66289c79aecab67040a22001'),
  run1Id: new mongoose.Types.ObjectId('66289c79aecab67040a23000'),
}

// Define data
const users = [
  {
    _id: predefinedIds.user1Id,
    username: 'user1',
    hash: await bcrypt.hash('password1', saltRounds),
  },
  {
    _id: predefinedIds.user2Id,
    username: 'user2',
    hash: await bcrypt.hash('password2', saltRounds),
  },
  {
    _id: predefinedIds.user3Id,
    username: 'user3',
    hash: await bcrypt.hash('password3', saltRounds),
  },
  {
    _id: predefinedIds.user4Id,
    username: 'user4',
    hash: await bcrypt.hash('password4', saltRounds),
    roles: ['admin'],
  },
  {
    _id: predefinedIds.centralUserId,
    username: 'centralUser',
    hash: await bcrypt.hash('centralPassword', saltRounds),
    roles: ['central'],
  },
  {
    _id: predefinedIds.user5IdVault,
    username: 'vaultUser1',
    hash: await bcrypt.hash('vaultPassword1', saltRounds),
    roles: ['vault'],
    vault: {
      name: 'TRENDS VBM Vault 1',
      description: 'TRENDS VBM vault 1 description',
    },
  },
]

const computations = [
    {
        _id: predefinedIds.computation1Id,
        title: "Single-Round Ridge Regression for FreeSurfer Data",
        imageName: "coinstacteam/nfc-single-round-ridge-regression-freesurfer",
        imageDownloadUrl: "docker pull coinstacteam/nfc-single-round-ridge-regression-freesurfer",
        notes: computationNotesSingleRoundRidgeRegressionFreesurfer,
        owner: predefinedIds.user1Id.toString(),
    },
]

const consortia = [
  {
    _id: predefinedIds.consortium1Id,
    title: 'Single Round Ridge Regression Consortium',
    description: 'Test consortium for single round ridge regression',
    leader: predefinedIds.user1Id,
    members: [predefinedIds.user1Id, predefinedIds.user2Id],
    activeMembers: [predefinedIds.user1Id, predefinedIds.user2Id],
    studyConfiguration: {
      consortiumLeaderNotes: 'Leader notes for single round ridge regression',
      computationParameters: JSON.stringify({
        "Dependents": {
          "4th-Ventricle":"float",
          "5th-Ventricle":"float"
        },
        "Covariates": {
          "sex":"str",
          "isControl":"bool",
          "age":"float"
        },
        "Lambda": 1,
        "IgnoreSubjectsWithInvalidData" : true
        }),
      computation: computations[0],
    },
  },
]

const runs = [
  {
    _id: predefinedIds.run1Id,
    consortium: predefinedIds.consortium1Id,
    consortiumLeader: predefinedIds.user1Id,
    studyConfiguration: consortia[0].studyConfiguration,
    members: consortia[0].members,
    status: 'Pending',
    runErrors: [],
    createdAt: new Date(),
    lastUpdated: new Date(),
  },
]

// Seeding Function
const seedDatabase = async () => {
  try {
    await mongoose.connect(url, { user, pass, authSource: 'admin' })
    logger.info('MongoDB connected successfully.')

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Consortium.deleteMany({}),
      Computation.deleteMany({}),
      Run.deleteMany({}),
    ])

    // Insert seed data
    await User.insertMany(users)
    logger.info('Users seeded successfully!')

    await Computation.insertMany(computations)
    logger.info('Computations seeded successfully!')

    await Consortium.insertMany(consortia)
    logger.info('Consortia seeded successfully!')

    // await Run.insertMany(runs);
    // logger.info('Runs seeded successfully!');
  } catch (error) {
    logger.error('Failed to seed database:', error)
  } finally {
    await mongoose.connection.close()
  }
}

seedDatabase()
