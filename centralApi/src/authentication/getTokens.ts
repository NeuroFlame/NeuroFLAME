import { generateTokens } from './authentication.js'
import { logger } from '../logger.js'

const centralToken = generateTokens(
  { userId: '66289c79aebab67040a20067', roles: ['central'] },
  { shouldExpire: false },
)
// Site tokens are sign-in sessions and expire like a login; service tokens do not.
const site1Token = generateTokens(
  { userId: '66289c79aebab67040a20068', roles: ['user'] },
)
const site2Token = generateTokens(
  { userId: '66289c79aebab67040a20069', roles: ['user'] },
)

const vaultUser1Token = generateTokens(
  { userId: '66289c79aebab67040a20072', roles: ['user', 'vault'] },
  { shouldExpire: false },
)

logger.info('Tokens generated', {
  context: { centralToken, site1Token, site2Token, vaultUser1Token },
})
