import mongoose, { Schema, Document, Model } from 'mongoose'

// Define an interface for the Vault
export interface IVault {
  name: string
  description: string
}

// Define an interface for running computation in vault status
export interface IVaultRunningComputation {
  runId: string
  consortiumId: string
  startedAt: Date
}

// Define an interface for vault status (reported via heartbeat)
export interface IVaultStatus {
  status: string
  version: string
  uptime: number
  websocketConnected: boolean
  lastHeartbeat: Date
  runningComputations: IVaultRunningComputation[]
}

// Define an interface for the User document
export interface IUser extends Document {
  username: string
  hash: string // Typically used to store the hashed password
  roles: string[] // An array of roles
  vault?: IVault // Optional embedded Vault object
  vaultStatus?: IVaultStatus // Optional vault status (for vault users)
  resetToken?: string
  resetTokenExpiry?: number
}

// Define the Vault sub-schema
const vaultSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
}, { _id: false }) // Disable _id for sub-documents if not needed

// Define the running computation sub-schema
const vaultRunningComputationSchema: Schema = new Schema({
  runId: { type: String, required: true },
  consortiumId: { type: String, required: true },
  startedAt: { type: Date, required: true },
}, { _id: false })

// Define the vault status sub-schema
const vaultStatusSchema: Schema = new Schema({
  status: { type: String, required: true },
  version: { type: String, required: true },
  uptime: { type: Number, required: true },
  websocketConnected: { type: Boolean, required: true },
  lastHeartbeat: { type: Date, required: true },
  runningComputations: { type: [vaultRunningComputationSchema], default: [] },
}, { _id: false })

// Create the User schema
const userSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  hash: { type: String, required: true }, // Storing password hashes, not plain passwords
  roles: { type: [String], required: true, default: ['user'] }, // Default role is 'user'
  vault: { type: vaultSchema, required: false }, // Optional embedded Vault
  vaultStatus: { type: vaultStatusSchema, required: false }, // Optional vault status
  resetToken: { type: String, required: false },
  resetTokenExpiry: { type: Date, required: false },
})

// Create the model
const User: Model<IUser> = mongoose.model<IUser>('User', userSchema)

export default User
