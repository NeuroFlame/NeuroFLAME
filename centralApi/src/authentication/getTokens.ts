import { generateTokens } from './authentication.js'
import { logger } from '../logger.js'

const centralToken = generateTokens(
  { userId: '66289c79aebab67040a20067', roles: ['central'] },
  { shouldExpire: false },
)
const site1Token = generateTokens(
  { userId: '66289c79aebab67040a20068', roles: ['user'] },
  { shouldExpire: false },
)
const site2Token = generateTokens(
  { userId: '66289c79aebab67040a20069', roles: ['user'] },
  { shouldExpire: false },
)

const vaultUser1Token = generateTokens(
  { userId: '66289c79aebab67040a20072', roles: ['user', 'vault'] },
  { shouldExpire: false },
)

logger.info('Tokens generated', {
  context: { centralToken, site1Token, site2Token, vaultUser1Token },
})
