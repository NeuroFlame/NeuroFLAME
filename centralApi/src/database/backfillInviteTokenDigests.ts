import Invite from './models/Invite.js'
import { inviteTokenDigest } from '../graphql/inviteEmail.js'

// Older invites stored the link token in plaintext. Replace each with its
// digest so outstanding links keep working without the token being stored.
export const backfillInviteTokenDigests = async (): Promise<number> => {
  const legacy = await Invite.collection
    .find({ token: { $type: 'string' } }, { projection: { token: 1 } })
    .toArray()
  for (const invite of legacy) {
    await Invite.collection.updateOne(
      { _id: invite._id, token: invite.token },
      { $set: { tokenDigest: inviteTokenDigest(invite.token) }, $unset: { token: '' } },
    )
  }
  return legacy.length
}
