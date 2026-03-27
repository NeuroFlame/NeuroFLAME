import mongoose, { Schema, Document, Model } from 'mongoose'

// Define an interface for the Invite document
interface IInvite extends Document {
  leader: mongoose.Types.ObjectId // Reference to a User
  consortium: mongoose.Types.ObjectId // Reference to a Consortium
  token: String
  email: String
  createdAt: Date
}

// Create the Invite schema
const inviteSchema: Schema = new Schema({
  leader: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  consortium: { type: mongoose.Types.ObjectId, ref: 'Consortium', required: true },
  token: { type: String, required: true },
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
})

// Create the model
const Invite: Model<IInvite> = mongoose.model<IInvite>('Invite', inviteSchema)

export default Invite
