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
  vaultMembers: mongoose.Types.ObjectId[] // Array of HostedVault references
  activeVaultMembers: mongoose.Types.ObjectId[] // Array of HostedVault references
  readyVaultMembers: mongoose.Types.ObjectId[] // Array of HostedVault references
  studyConfiguration: IStudyConfiguration
  isPrivate: boolean
}

// Create the Consortium schema
const consortiumSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: false },
  leader: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
  activeMembers: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
  readyMembers: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
  vaultMembers: [{ type: mongoose.Types.ObjectId, ref: 'HostedVault' }],
  activeVaultMembers: [{ type: mongoose.Types.ObjectId, ref: 'HostedVault' }],
  readyVaultMembers: [{ type: mongoose.Types.ObjectId, ref: 'HostedVault' }],
  studyConfiguration: { type: studyConfigurationSchema, required: true }, // Make sure studyConfiguration is always present
  isPrivate: { type: Boolean, required: false, default: false },
})

// Create the model
const Consortium: Model<IConsortium> = mongoose.model<IConsortium>(
  'Consortium',
  consortiumSchema,
)

export default Consortium
