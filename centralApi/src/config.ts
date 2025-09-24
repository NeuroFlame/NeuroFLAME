import dotenv from 'dotenv'

dotenv.config()

export const FILE_SERVER_URL = process.env.FILE_SERVER_URL || ''
export const APOLLO_PORT = Number(process.env.APOLLO_PORT || '')
export const DATABASE_URI = process.env.DATABASE_URI || ''
export const LOG_PATH = process.env.LOG_PATH || ''
export const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
export const COINSTAC_CONFIGURATIONS_FOLDER = process.env.COINSTAC_CONFIGURATIONS_FOLDER || ''
export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || ''
export const ACCESS_TOKEN_DURATION = process.env.ACCESS_TOKEN_DURATION || ''
