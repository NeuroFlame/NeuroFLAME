import Invite from './database/models/Invite.js'
import User from './database/models/User.js'

export const INVITE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000

interface PopulatedInvite {
  consortium: {
    _id?: { toString(): string }
    id?: string
    title?: string
    members?: Array<{ toString(): string }>
  } | null
  leader: object | null
  email: string
  createdAt: Date
  deleteOne(): Promise<unknown>
}

export interface ValidatedConsortiumInvite {
  invite: Pick<PopulatedInvite, 'deleteOne'>
  consortiumId: string
  consortiumTitle: string
  intendedAccount: string
}

export async function validateConsortiumInviteForUser(
  inviteToken: string,
  userId: string,
): Promise<ValidatedConsortiumInvite> {
  const [inviteResult, user] = await Promise.all([
    Invite.findOne({ token: inviteToken })
      .populate('leader', '_id')
      .populate('consortium', '_id title members'),
    User.findById(userId).select('username').lean(),
  ])
  const invite = inviteResult as unknown as PopulatedInvite | null
  if (!invite) throw new Error('Invalid invite link')
  if (!invite.consortium || !invite.leader) {
    throw new Error('Invite is missing consortium or leader information')
  }
  if (!user) throw new Error('User not found')
  if (user.username !== invite.email) throw new Error('Invalid invite link')

  const consortiumId = invite.consortium._id?.toString() ?? invite.consortium.id
  if (!consortiumId || !invite.consortium.title || !Array.isArray(invite.consortium.members)) {
    throw new Error('Invite is missing consortium information')
  }
  if (new Date(invite.createdAt).getTime() < Date.now() - INVITE_EXPIRATION_MS) {
    throw new Error('Invite is expired')
  }
  if (invite.consortium.members.some((memberId) => memberId.toString() === userId)) {
    throw new Error('You\'re already a member of this consortium')
  }

  return {
    invite,
    consortiumId,
    consortiumTitle: invite.consortium.title,
    intendedAccount: user.username,
  }
}
