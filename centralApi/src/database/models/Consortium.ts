import mongoose, { Schema, Document, Model } from 'mongoose'
import {
  IStudyConfiguration,
  studyConfigurationSchema,
} from './StudyConfiguration.js'

// Define an interface for the Consortium document
interface IConsortium extends Document {
  title: string
  description: string
  leader: mongoose.Types.ObjectId // Reference to a User
  members: mongoose.Types.ObjectId[] // Array of User references
  activeMembers: mongoose.Types.ObjectId[] // Array of User references
  readyMembers: mongoose.Types.ObjectId[] // Array of User references
  studyConfiguration: IStudyConfiguration
}

// Create the Consortium schema
const consortiumSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: false },
  leader: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
  activeMembers: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
  readyMembers: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
  studyConfiguration: { type: studyConfigurationSchema, required: true }, // Make sure studyConfiguration is always present
})

// Create the model
const Consortium: Model<IConsortium> = mongoose.model<IConsortium>(
  'Consortium',
  consortiumSchema,
)

export default Consortium
