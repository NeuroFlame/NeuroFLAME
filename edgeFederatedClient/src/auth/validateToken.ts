import axios from 'axios'
import { getConfig } from '../config/config.js'
import { logger } from '../logger.js'

export type TokenPayload = {
  userId?: string
  participantId?: string
  runId?: string
  consortiumId?: string
  roles?: string[]
}

export const validateToken = async (
  accessToken: string,
): Promise<TokenPayload> => {
  const { authenticationEndpoint } = await getConfig()
  try {
    const response = await axios.post<{ decodedAccessToken: TokenPayload }>(
      authenticationEndpoint,
      { token: accessToken },
      { headers: { 'Content-Type': 'application/json' } },
    )

    return response.data.decodedAccessToken
  } catch (error) {
    logger.error(`Error fetching decoded token: ${(error as Error).message}`)
    throw new Error(`Error fetching decoded token: ${(error as Error).message}`)
  }
}
