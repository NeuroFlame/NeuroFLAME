import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IMcpAuthorizationCode extends Document {
  codeHash: string
  clientId: string
  userId: mongoose.Types.ObjectId
  redirectUri: string
  codeChallenge: string
  scopes: string[]
  resource: string
  authorizationEpoch: number
  expiresAt: Date
}

const mcpAuthorizationCodeSchema = new Schema<IMcpAuthorizationCode>({
  codeHash: { type: String, required: true, unique: true, index: true },
  clientId: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  redirectUri: { type: String, required: true },
  codeChallenge: { type: String, required: true },
  scopes: { type: [String], required: true },
  resource: { type: String, required: true },
  authorizationEpoch: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
})

const McpAuthorizationCode: Model<IMcpAuthorizationCode> =
  mongoose.model<IMcpAuthorizationCode>(
    'McpAuthorizationCode',
    mcpAuthorizationCodeSchema,
  )

export default McpAuthorizationCode
