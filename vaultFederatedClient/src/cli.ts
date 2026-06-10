#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const REQUIRED_ENV = [
  'VAULT_HTTP_URL',
  'VAULT_WS_URL',
  'VAULT_ACCESS_TOKEN',
  'VAULT_BASE_DIR',
  'VAULT_DATASET_DIR',
]

const OPTIONAL_ENV = [
  'VAULT_LOG_PATH',
  'VAULT_CONTAINER_SERVICE',
]

function printHelp(): void {
  console.log(`NeuroFLAME Vault

Usage:
  neuroflame-vault start
  neuroflame-vault validate
  neuroflame-vault env
  neuroflame-vault systemd-template [--force]

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
  const templatePath = path.join(packageRoot, 'systemd', 'neuroflame-vault.service')
  const targetPath = path.join(process.cwd(), 'neuroflame-vault.service')

  if (!force && await pathExists(targetPath)) {
    throw new Error(`${targetPath} already exists. Re-run with --force to overwrite.`)
  }

  await fs.copyFile(templatePath, targetPath)
  console.log(`Wrote ${targetPath}`)
}

function maskEnvValue(name: string, value: string): string {
  if (name !== 'VAULT_ACCESS_TOKEN') {
    return value
  }

  if (value.length <= 12) {
    return '********'
  }

  return `${value.slice(0, 6)}...${value.slice(-6)}`
}

function validateEnv(): string[] {
  const errors = REQUIRED_ENV
    .filter((name) => !process.env[name])
    .map((name) => `Missing ${name}`)

  const containerService = process.env.VAULT_CONTAINER_SERVICE
  if (
    containerService &&
    !['docker', 'singularity'].includes(containerService.trim().toLowerCase())
  ) {
    errors.push('VAULT_CONTAINER_SERVICE must be docker or singularity')
  }

  return errors
}

function printEnv(): void {
  [...REQUIRED_ENV, ...OPTIONAL_ENV].forEach((name) => {
    const value = process.env[name]
    if (value) {
      console.log(`${name}=${maskEnvValue(name, value)}`)
    }
  })
}

async function startVault(): Promise<void> {
  const errors = validateEnv()
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`[CONFIG] ${error}`))
    process.exit(1)
  }

  await import('./index.js')
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

    console.log('Vault environment is valid')
    return
  }

  if (command === 'start') {
    await startVault()
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
