import jwt, { JwtPayload } from 'jsonwebtoken'
import { hash } from 'bcrypt'
export { compare } from 'bcrypt'
import {
  ACCESS_TOKEN_DURATION,
  ACCESS_TOKEN_SECRET,
} from '../config/environmentVariables.js'

const { sign, verify } = jwt

interface AccessTokenPayload extends JwtPayload {
  userId: string;
  roles?: string[];
}

export const generateTokens = (
  payload = {},
  options: { shouldExpire?: boolean } = {},
) => {
  const { shouldExpire = true } = options

  const accessTokenOptions = shouldExpire
    ? { expiresIn: ACCESS_TOKEN_DURATION }
    : {}

  const accessToken = sign(payload, ACCESS_TOKEN_SECRET, accessTokenOptions)

  return { accessToken }
}

export const validateAccessToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }

  return decoded;
};

export const hashPassword = async (password) => {
  const saltRounds = 10
  return hash(password, saltRounds)
}