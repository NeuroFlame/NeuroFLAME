import dotenv from 'dotenv'

dotenv.config()

export const HTTP_URL = process.env.HTTP_URL || ''
export const WS_URL = process.env.WS_URL || ''
export const ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''
export const FILE_SERVER_URL = process.env.FILE_SERVER_URL || ''
export const BASE_DIR = process.env.BASE_DIR || ''
export const FQDN = process.env.FQDN || ''
export const LOG_PATH = process.env.LOG_PATH || ''
export const HOSTING_PORT_START = Number(process.env.HOSTING_PORT_START || '')
export const HOSTING_PORT_END = Number(process.env.HOSTING_PORT_END || '')
