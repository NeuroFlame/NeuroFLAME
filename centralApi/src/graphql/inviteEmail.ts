import { createHash } from 'node:crypto'

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
}

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character])

// Consortium titles and usernames are user-controlled; keep them to one plain
// line so they cannot add markup, links or extra header lines to the email.
const plainLine = (value: string, maxLength: number): string =>
  Array.from(value, (character) => {
    const code = character.charCodeAt(0)
    return code < 0x20 || code === 0x7f ? ' ' : character
  }).join('').replace(/ {2,}/g, ' ').trim().slice(0, maxLength)

export const buildInviteEmail = ({
  leaderName,
  consortiumTitle,
  inviteUrl,
}: {
  leaderName: string
  consortiumTitle: string
  inviteUrl: string
}): { subject: string; html: string } => {
  const leader = plainLine(leaderName, 254)
  const title = plainLine(consortiumTitle, 200)
  return {
    subject: `Invitation to join "${title}" on NeuroFLAME`,
    html: `${escapeHtml(leader)} invites you to join the consortium "${escapeHtml(title)}" on NeuroFLAME. <br/>
      Please click this <a href="${escapeHtml(inviteUrl)}">link</a> to join.`,
  }
}

// Invite links are bearer credentials; only their digest is stored.
export const inviteTokenDigest = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

export const isInviteToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
