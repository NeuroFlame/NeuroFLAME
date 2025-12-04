import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IComputation extends Document {
  title: string;
  imageName: string;
  imageDownloadUrl: string;
  notes: string;
  owner: string;
  hasLocalParameters?: boolean;
}

const computationSchema: Schema = new Schema({
  title: { type: String, required: true },
  imageName: { type: String, required: true },
  imageDownloadUrl: { type: String, required: true },
  notes: { type: String, required: true },
  owner: { type: String, required: false },
  hasLocalParameters: { type: Boolean, required: false, default: false },
})

export const Computation: Model<IComputation> =
  mongoose.model<IComputation>('Computation', computationSchema)
export { computationSchema } // Export the schema for reuse

export default Computation
