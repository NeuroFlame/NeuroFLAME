import mongoose, { Schema, Document, Model } from 'mongoose'

// Define an interface for the Vault
export interface IVault {
  name: string
  description: string
}

// Define an interface for the User document
export interface IUser extends Document {
  username: string
  hash: string // Typically used to store the hashed password
  roles: string[] // An array of roles
  vault?: IVault // Optional embedded Vault object
}

// Define the Vault sub-schema
const vaultSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
}, { _id: false }) // Disable _id for sub-documents if not needed

// Create the User schema
const userSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  hash: { type: String, required: true }, // Storing password hashes, not plain passwords
  roles: { type: [String], required: true, default: ['user'] }, // Default role is 'user'
  vault: { type: vaultSchema, required: false }, // Optional embedded Vault
})

// Create the model
const User: Model<IUser> = mongoose.model<IUser>('User', userSchema)

export default User
