import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IMcpClient extends Document {
  clientId: string
  clientName: string
  redirectUris: string[]
  tokenEndpointAuthMethod: string
  createdAt: Date
}

const mcpClientSchema = new Schema<IMcpClient>({
  clientId: { type: String, required: true, unique: true, index: true },
  clientName: { type: String, required: true },
  redirectUris: { type: [String], required: true },
  tokenEndpointAuthMethod: { type: String, required: true, default: 'none' },
  createdAt: { type: Date, required: true, default: Date.now },
})

const McpClient: Model<IMcpClient> = mongoose.model<IMcpClient>(
  'McpClient',
  mcpClientSchema,
)

export default McpClient
