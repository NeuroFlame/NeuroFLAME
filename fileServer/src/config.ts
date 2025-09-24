import dotenv from 'dotenv'

dotenv.config()

export const AUTHENTICATION_URL = process.env.AUTHENTICATION_URL || ''
export const BASE_DIR = process.env.BASE_DIR || ''
export const PORT = Number(process.env.PORT || '')
export const LOG_PATH = process.env.LOG_PATH || ''
