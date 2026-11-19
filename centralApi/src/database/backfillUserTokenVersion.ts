import User from './models/User.js'

// Match raw stored documents: Mongoose's default does not persist missing fields.
export const backfillUserTokenVersion = async (): Promise<number> => {
  const result = await User.collection.updateMany(
    { tokenVersion: { $exists: false } },
    { $set: { tokenVersion: 0 } },
  )
  return result.modifiedCount
}
