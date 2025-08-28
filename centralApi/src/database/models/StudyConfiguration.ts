import { Schema, Document } from 'mongoose'
import { computationSchema, IComputation } from './Computation.js'

// Define an interface for the StudyConfiguration part of documents
export interface IStudyConfiguration extends Document {
  consortiumLeaderNotes: string
  computationParameters: string
  computation: IComputation // Optional reference to a Computation document
}

// Create a schema for the Study Configuration
export const studyConfigurationSchema: Schema = new Schema(
  {
    consortiumLeaderNotes: { type: String, required: false, default: '' },
    computationParameters: { type: String, required: false, default: '{}' },
    computation: { type: computationSchema, required: false }, // Optional reference to Computation
  },
  { _id: false },
) // _id is not needed for nested schemas unless explicitly required
