import { randomUUID } from 'crypto'
import { logger } from '../logger.js'

export interface McpSessionTransport {
  close(): Promise<void>
  handleRequest(...args: any[]): Promise<void>
}

export interface McpSessionRecord {
  transport: McpSessionTransport
  userId: string
  clientId: string
  familyId: string
  scopes: string[]
  lastUsedAt: number
}

interface Reservation {
  userId: string
  familyId: string
}

export class McpSessionRegistry {
  private readonly sessions = new Map<string, McpSessionRecord>()
  private readonly reservations = new Map<string, Reservation>()

  constructor(private readonly perUserLimit = 10) {}

  reserve(userId: string, familyId: string): string | undefined {
    const active = Array.from(this.sessions.values())
      .filter((session) => session.userId === userId).length
    const pending = Array.from(this.reservations.values())
      .filter((reservation) => reservation.userId === userId).length
    if (active + pending >= this.perUserLimit) return undefined
    const reservationId = randomUUID()
    this.reservations.set(reservationId, { userId, familyId })
    return reservationId
  }

  register(
    reservationId: string,
    sessionId: string,
    session: McpSessionRecord,
  ): boolean {
    const reservation = this.reservations.get(reservationId)
    if (
      !reservation ||
      reservation.userId !== session.userId ||
      reservation.familyId !== session.familyId
    ) return false
    this.reservations.delete(reservationId)
    this.sessions.set(sessionId, session)
    return true
  }

  release(reservationId: string): void {
    this.reservations.delete(reservationId)
  }

  get(sessionId: string): McpSessionRecord | undefined {
    return this.sessions.get(sessionId)
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  async reapOlderThan(cutoff: number): Promise<void> {
    await this.closeMatching((session) => session.lastUsedAt < cutoff)
  }

  async closeFamily(familyId: string): Promise<void> {
    for (const [id, reservation] of this.reservations) {
      if (reservation.familyId === familyId) this.reservations.delete(id)
    }
    await this.closeMatching((session) => session.familyId === familyId)
  }

  async closeUser(userId: string): Promise<void> {
    for (const [id, reservation] of this.reservations) {
      if (reservation.userId === userId) this.reservations.delete(id)
    }
    await this.closeMatching((session) => session.userId === userId)
  }

  activeCountForUser(userId: string): number {
    return Array.from(this.sessions.values())
      .filter((session) => session.userId === userId).length
  }

  private async closeMatching(
    predicate: (session: McpSessionRecord) => boolean,
  ): Promise<void> {
    const matching = Array.from(this.sessions.entries())
      .filter(([, session]) => predicate(session))
    for (const [id, session] of matching) {
      this.sessions.delete(id)
      try {
        await session.transport.close()
      } catch {
        logger.warn('Unable to close an invalidated MCP session', { sessionId: id })
      }
    }
  }
}

export const mcpSessionRegistry = new McpSessionRegistry()

export const closeMcpSessionsForFamily = async (familyId: string): Promise<void> =>
  mcpSessionRegistry.closeFamily(familyId)

export const closeMcpSessionsForUser = async (userId: string): Promise<void> =>
  mcpSessionRegistry.closeUser(userId)
