import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IHostedVault extends Document {
  server: mongoose.Types.ObjectId
  name: string
  description: string
  datasetKey: string
  allowedComputations: mongoose.Types.ObjectId[]
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const hostedVaultSchema: Schema = new Schema({
  server: {
    type: mongoose.Types.ObjectId,
    ref: 'VaultServer',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, default: '' },
  datasetKey: { type: String, required: true, trim: true },
  allowedComputations: [{
    type: mongoose.Types.ObjectId,
    ref: 'Computation',
  }],
  active: { type: Boolean, required: true, default: true },
}, { timestamps: true })

hostedVaultSchema.index({ server: 1, datasetKey: 1 }, { unique: true })

const HostedVault: Model<IHostedVault> = mongoose.model<IHostedVault>(
  'HostedVault',
  hostedVaultSchema,
)

export default HostedVault
