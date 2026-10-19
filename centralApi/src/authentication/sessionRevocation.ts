import { EventEmitter } from 'node:events'

const revocations = new EventEmitter()
type RevocationListener = (userId: string, tokenVersion: number) => void

export const revokeUserSessions = (userId: string, tokenVersion: number): void => {
  revocations.emit('revoked', userId, tokenVersion)
}

export const onSessionRevocation = (listener: RevocationListener): (() => void) => {
  revocations.on('revoked', listener)
  return () => { revocations.off('revoked', listener) }
}
