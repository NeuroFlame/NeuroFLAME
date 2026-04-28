import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IVaultServerRunningComputation {
  runId: string
  consortiumId: string
  startedAt: Date
}

export interface IVaultServerDataset {
  key: string
  path: string
  label?: string
}

export interface IVaultServerStatus {
  status: string
  version: string
  uptime: number
  websocketConnected: boolean
  lastHeartbeat: Date
  runningComputations: IVaultServerRunningComputation[]
  availableDatasets: IVaultServerDataset[]
}

export interface IVaultServer extends Document {
  user: mongoose.Types.ObjectId
  name: string
  description: string
  status?: IVaultServerStatus
  createdAt: Date
  updatedAt: Date
}

const runningComputationSchema: Schema = new Schema({
  runId: { type: String, required: true },
  consortiumId: { type: String, required: true },
  startedAt: { type: Date, required: true },
}, { _id: false })

const availableDatasetSchema: Schema = new Schema({
  key: { type: String, required: true, trim: true },
  path: { type: String, required: true, trim: true },
  label: { type: String, required: false, trim: true },
}, { _id: false })

const vaultServerStatusSchema: Schema = new Schema({
  status: { type: String, required: true },
  version: { type: String, required: true },
  uptime: { type: Number, required: true },
  websocketConnected: { type: Boolean, required: true },
  lastHeartbeat: { type: Date, required: true },
  runningComputations: { type: [runningComputationSchema], default: [] },
  availableDatasets: { type: [availableDatasetSchema], default: [] },
}, { _id: false })

const vaultServerSchema: Schema = new Schema({
  user: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, default: '' },
  status: { type: vaultServerStatusSchema, required: false },
}, { timestamps: true })

const VaultServer: Model<IVaultServer> = mongoose.model<IVaultServer>(
  'VaultServer',
  vaultServerSchema,
)

export default VaultServer
