import dotenv from 'dotenv'

dotenv.config()

export const HTTP_URL = process.env.HTTP_URL || ''
export const WS_URL = process.env.WS_URL || ''
export const ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''
export const FILE_SERVER_URL = process.env.FILE_SERVER_URL || ''
export const BASE_IDR = process.env.BASE_IDR || ''
export const DATASET_DIR = process.env.DATASET_DIR || ''
export const LOG_PATH = process.env.LOG_PATH || ''
