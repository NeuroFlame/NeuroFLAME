import mongoose, { Schema, Document, Model } from 'mongoose'
import {
  IStudyConfiguration,
  studyConfigurationSchema,
} from './StudyConfiguration.js'

// Define an interface for the error entries in the runErrors array
interface IRunError {
  user: mongoose.Types.ObjectId // Reference to the User model
  timestamp: string // String representing the numeric timestamp
  message: string // Error message
}

// Define an interface for the Run document
export interface IRun extends Document {
  consortium: mongoose.Types.ObjectId // Reference to the Consortium model
  consortiumLeader: mongoose.Types.ObjectId // Reference to the User model
  studyConfiguration: IStudyConfiguration
  members: mongoose.Types.ObjectId[] // Array of User references
  status: string // Could be an enum or simple string
  runErrors: IRunError[] // Array of error objects
  lastUpdated: string // String representing the numeric timestamp
  createdAt: string // String representing the numeric timestamp
  meta?: any   // Optional meta field of any type
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
  status: { type: String, required: true, default: 'Pending' },
  runErrors: [
    {
      user: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
      timestamp: {
        type: String,
        default: () => Date.now().toString(), // Store the numeric timestamp as a string
        required: true,
      },
      message: { type: String, required: true },
    },
  ],

  createdAt: { type: String, default: Date.now },
  lastUpdated: { type: String, default: Date.now },
  meta: { type: Schema.Types.Mixed, default: null }, 
})

// Create the model
const Run: Model<IRun> = mongoose.model<IRun>('Run', runSchema)

export default Run
