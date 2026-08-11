import { validateConsortiumInviteForUser } from '../invitations.js'
import type { WritePreviewField } from './writeConfirmation.js'

export interface InviteWriteApproval {
  summary: string
  preview: WritePreviewField[]
}

export async function buildInviteWriteApproval(
  userId: string,
  inviteToken: string,
): Promise<InviteWriteApproval> {
  const target = await validateConsortiumInviteForUser(inviteToken, userId)
  return {
    summary: `Join consortium “${target.consortiumTitle}” (${target.consortiumId}) as ${target.intendedAccount}?`,
    preview: [
      { label: 'consortiumTitle', value: target.consortiumTitle },
      { label: 'consortiumId', value: target.consortiumId },
      { label: 'account', value: target.intendedAccount },
    ],
  }
}
