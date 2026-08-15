import mongoose, { Schema, Document, Model } from 'mongoose'
import {
  IStudyConfiguration,
  studyConfigurationSchema,
} from './StudyConfiguration.js'

// Define an interface for the error entries in the runErrors array
interface IRunError {
  user: mongoose.Types.ObjectId // Reference to the User model
  vault?: mongoose.Types.ObjectId // Hosted vault that executed the computation
  timestamp: string // String representing the numeric timestamp
  message: string // Error message
}

export interface IResolvedComputationImage {
  sourceImage: string
  reference: string
  digest: string
  metadata: {
    title: string
    computationVersion: string
    revision: string
    source: string
    computationApiVersion: string
    boilerplateVersion: string
    nvflareVersion: string
  }
}

// Define an interface for the Run document
export interface IRun extends Document {
  consortium: mongoose.Types.ObjectId // Reference to the Consortium model
  consortiumLeader: mongoose.Types.ObjectId // Reference to the User model
  studyConfiguration: IStudyConfiguration
  members: mongoose.Types.ObjectId[] // Array of User references
  vaultMembers: mongoose.Types.ObjectId[] // Array of HostedVault references
  status: string // Could be an enum or simple string
  runErrors: IRunError[] // Array of error objects
  resolvedComputationImage?: IResolvedComputationImage
  lastUpdated: string // String representing the numeric timestamp
  createdAt: string // String representing the numeric timestamp
}

// Create the Run schema
const runSchema: Schema = new Schema({
  consortium: {
    type: mongoose.Types.ObjectId,
    ref: 'Consortium',
    required: true,
  },
  consortiumLeader: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  studyConfiguration: { type: studyConfigurationSchema, required: true },
  members: [{ type: mongoose.Types.ObjectId, ref: 'User', required: true }],
  vaultMembers: [{ type: mongoose.Types.ObjectId, ref: 'HostedVault', required: true }],
  status: { type: String, required: true, default: 'Pending' },
  runErrors: [
    {
      user: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
      vault: { type: mongoose.Types.ObjectId, ref: 'HostedVault', required: false },
      timestamp: {
        type: String,
        default: () => Date.now().toString(), // Store the numeric timestamp as a string
        required: true,
      },
      message: { type: String, required: true },
    },
  ],
  resolvedComputationImage: {
    type: {
      sourceImage: { type: String, required: true },
      reference: { type: String, required: true },
      digest: { type: String, required: true },
      metadata: {
        title: { type: String, required: true },
        computationVersion: { type: String, required: true },
        revision: { type: String, required: true },
        source: { type: String, required: true },
        computationApiVersion: { type: String, required: true },
        boilerplateVersion: { type: String, required: true },
        nvflareVersion: { type: String, required: true },
      },
    },
    required: false,
    _id: false,
  },

  createdAt: { type: String, default: Date.now },
  lastUpdated: { type: String, default: Date.now },
})

// Create the model
const Run: Model<IRun> = mongoose.model<IRun>('Run', runSchema)

export default Run
