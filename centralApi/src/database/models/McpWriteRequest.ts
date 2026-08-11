import mongoose, { Document, Model, Schema } from 'mongoose'

export type McpWriteRequestStatus = 'pending' | 'approved' | 'denied' | 'consumed'

export interface IMcpWritePreviewField {
  label: string
  value: string
  fullValue?: string
}

export interface IMcpWriteRequest extends Document {
  requestId: string
  userId: mongoose.Types.ObjectId
  familyId: string
  clientName: string
  authorizationEpoch: number
  toolName: string
  operationHash: string
  summary: string
  preview: IMcpWritePreviewField[]
  status: McpWriteRequestStatus
  createdAt: Date
  expiresAt: Date
  decidedAt?: Date
}

const mcpWriteRequestSchema = new Schema<IMcpWriteRequest>({
  requestId: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  familyId: { type: String, required: true, index: true },
  clientName: { type: String, required: true },
  authorizationEpoch: { type: Number, required: true },
  toolName: { type: String, required: true },
  operationHash: { type: String, required: true },
  summary: { type: String, required: true },
  preview: [{
    _id: false,
    label: { type: String, required: true },
    value: { type: String, required: true },
    fullValue: { type: String, required: false },
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'consumed'],
    required: true,
    default: 'pending',
  },
  createdAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 },
  decidedAt: { type: Date, required: false },
})

const McpWriteRequest: Model<IMcpWriteRequest> = mongoose.model<IMcpWriteRequest>(
  'McpWriteRequest',
  mcpWriteRequestSchema,
)

export default McpWriteRequest
