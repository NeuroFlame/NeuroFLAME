import { createLogger, format, transports } from 'winston'
import path from 'path'
import fs from 'fs'

// Type guard to check if an object is an Error
const isError = (obj: any): obj is Error => obj instanceof Error

const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf((info) => {
      const { timestamp, level, stack, message, context, error, ...meta } = info
      const prefix = `${timestamp} ${level}:`
      let output = prefix

      if (message) {
        output += ` ${message}`
      }

      // Safely access the error stack
      const errorStack =
        stack || meta.stack || (isError(error) ? error.stack : undefined)
      if (errorStack) {
        output += `\nStack: ${errorStack}`
      }

      if (error && !(error instanceof Error)) {
        const errorDetails = safeSerialize(error)
        output += `\nError Details: ${errorDetails}`
      }

      if (context) {
        output += `\nContext: ${JSON.stringify(context, null, 2)}`
      }
      return output
    }),
  ),
  transports: [
    new transports.Console({
      level: 'info',
      format: format.colorize({ all: true }),
    }),
  ],
})

const logToPath = (logDir: string): void => {
  try {
    // Ensure log directory exists
    console.log('logDir:', logDir)
    if (!fs.existsSync(logDir)) {
      console.log('Creating log directory')
      fs.mkdirSync(logDir, { recursive: true })
    }

    const logFilePath = path.join(logDir, 'application.log')
    const errorLogFilePath = path.join(logDir, 'error.log')

    // Add file transports with rotation
    logger.add(
      new transports.File({
        filename: logFilePath,
        level: 'info',
        maxsize: 5 * 1024 * 1024, // 5MB max file size
        maxFiles: 5, // Keep 5 backup files
        tailable: true, // Allows the last log file to be the one being written to
      }),
    )
    logger.add(
      new transports.File({
        filename: errorLogFilePath,
        level: 'error',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
        tailable: true,
      }),
    )

    // Handle uncaught exceptions and unhandled rejections
    logger.exceptions.handle(
      new transports.File({
        filename: path.join(logDir, 'exceptions.log'),
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
    )
    logger.rejections.handle(
      new transports.File({
        filename: path.join(logDir, 'rejections.log'),
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
    )

    logger.info(`Logging initialized with directory: ${logDir}`)
  } catch (error) {
    console.error('Failed to set up file transports for logging:', error)
  }
}

const safeSerialize = (obj: unknown): string => {
  try {
    if (typeof obj !== 'object' || obj === null) {
      return JSON.stringify(obj, null, 2)
    }

    const result: Record<string | symbol, unknown> = {}

    // Include regular properties
    Object.getOwnPropertyNames(obj).forEach((key) => {
      result[key] = (obj as Record<string, unknown>)[key]
    })

    // Include symbol properties
    Object.getOwnPropertySymbols(obj).forEach((symbol) => {
      result[symbol.toString()] = (obj as Record<symbol, unknown>)[symbol]
    })

    return JSON.stringify(result, null, 2)
  } catch {
    return 'Unable to serialize object'
  }
}

export { logToPath, logger }
