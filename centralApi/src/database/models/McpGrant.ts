import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IMcpGrant extends Document {
  userId: mongoose.Types.ObjectId
  familyId: string
  clientId: string
  clientName: string
  accessTokenHash: string
  refreshTokenHash: string
  spentRefreshTokenHashes: string[]
  refreshRotationCount: number
  scopes: string[]
  resource: string
  authorizationEpoch: number
  accessExpiresAt: Date
  refreshExpiresAt: Date
  familyExpiresAt: Date
  createdAt: Date
  lastUsedAt: Date
  revokedAt?: Date
}

const mcpGrantSchema = new Schema<IMcpGrant>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  familyId: { type: String, required: true, unique: true, index: true },
  clientId: { type: String, required: true, index: true },
  clientName: { type: String, required: true },
  accessTokenHash: { type: String, required: true, unique: true, index: true },
  refreshTokenHash: { type: String, required: true, unique: true, index: true },
  spentRefreshTokenHashes: { type: [String], required: true, default: [], index: true },
  refreshRotationCount: { type: Number, required: true, default: 0 },
  scopes: { type: [String], required: true },
  resource: { type: String, required: true },
  authorizationEpoch: { type: Number, required: true },
  accessExpiresAt: { type: Date, required: true },
  refreshExpiresAt: { type: Date, required: true, expires: 0 },
  familyExpiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, required: true, default: Date.now },
  lastUsedAt: { type: Date, required: true, default: Date.now },
  revokedAt: { type: Date, required: false },
})

const McpGrant: Model<IMcpGrant> = mongoose.model<IMcpGrant>(
  'McpGrant',
  mcpGrantSchema,
)

export default McpGrant
