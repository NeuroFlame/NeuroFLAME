import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IMcpAuthorizationRequest extends Document {
  requestHash: string
  clientId: string
  clientName: string
  redirectUri: string
  codeChallenge: string
  scopes: string[]
  resource: string
  state?: string
  attemptsRemaining: number
  expiresAt: Date
  consumedAt?: Date
}

const mcpAuthorizationRequestSchema = new Schema<IMcpAuthorizationRequest>({
  requestHash: { type: String, required: true, unique: true, index: true },
  clientId: { type: String, required: true, index: true },
  clientName: { type: String, required: true },
  redirectUri: { type: String, required: true },
  codeChallenge: { type: String, required: true },
  scopes: { type: [String], required: true },
  resource: { type: String, required: true },
  state: { type: String, required: false },
  attemptsRemaining: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  consumedAt: { type: Date, required: false },
})

const McpAuthorizationRequest: Model<IMcpAuthorizationRequest> =
  mongoose.model<IMcpAuthorizationRequest>(
    'McpAuthorizationRequest',
    mcpAuthorizationRequestSchema,
  )

export default McpAuthorizationRequest
