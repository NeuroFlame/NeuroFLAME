import dotenv from 'dotenv'

dotenv.config()

export const AUTHENTICATION_URL = process.env.AUTHENTICATION_URL || ''
export const BASE_DIR = process.env.FILE_SERVER_BASE_DIR || ''
export const PORT = Number(process.env.FILE_SERVER_PORT || '')
export const LOG_PATH = process.env.LOG_PATH || ''
