#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { REQUIRED_ENV, OPTIONAL_ENV, loadConfigFromEnv, validateEnv } from './envConfig.js'
import { start } from './index.js'
import { logger } from './logger.js'

function printHelp(): void {
  console.log(`NeuroFLAME Edge Federated Client

Usage:
  neuroflame-edge start
  neuroflame-edge validate
  neuroflame-edge env
  neuroflame-edge systemd-template [--force]

Configuration is read from environment variables.

Required:
  ${REQUIRED_ENV.join(', ')}

Optional:
  ${OPTIONAL_ENV.join(', ')}`)
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function writeSystemdTemplate(force: boolean): Promise<void> {
  const currentFile = fileURLToPath(import.meta.url)
  const packageRoot = path.resolve(path.dirname(currentFile), '..')
  const templatePath = path.join(packageRoot, 'systemd', 'neuroflame-edge.service')
  const targetPath = path.join(process.cwd(), 'neuroflame-edge.service')

  if (!force && await pathExists(targetPath)) {
    throw new Error(`${targetPath} already exists. Re-run with --force to overwrite.`)
  }

  await fs.copyFile(templatePath, targetPath)
  console.log(`Wrote ${targetPath}`)
}

function printEnv(): void {
  [...REQUIRED_ENV, ...OPTIONAL_ENV].forEach((name) => {
    const value = process.env[name]
    if (value) {
      console.log(`${name}=${value}`)
    }
  })
}

function setupSignalHandlers(): void {
  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down...`)
    // Deliberately simple: unlike vaultFederatedClient, there's no
    // in-flight-container tracking to wait on here yet. A run's own
    // container process is left running (matching how the desktop app
    // quitting mid-run already behaves today) — this just stops the
    // server accepting new GraphQL/REST requests.
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

function startEdge(): void {
  const errors = validateEnv()
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`[CONFIG] ${error}`))
    process.exit(1)
  }

  setupSignalHandlers()
  const config = loadConfigFromEnv()
  start(config)
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'start'

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === 'env') {
    printEnv()
    return
  }

  if (command === 'systemd-template') {
    await writeSystemdTemplate(process.argv.includes('--force'))
    return
  }

  if (command === 'validate') {
    const errors = validateEnv()
    if (errors.length > 0) {
      errors.forEach((error) => console.error(error))
      process.exitCode = 1
      return
    }
    console.log('Edge client environment is valid')
    return
  }

  if (command === 'start') {
    startEdge()
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
