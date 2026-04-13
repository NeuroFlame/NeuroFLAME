#!/usr/bin/env node

/**
 * Dev-only script to load .env file and run a command.
 * This is NOT used in production - production expects env vars to be set externally.
 *
 * With no args, it starts the API.
 * If .env doesn't exist, it will be created from .env.template.
 */

import { readFileSync, existsSync, copyFileSync } from 'fs'
import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '.env')
const templatePath = join(__dirname, '.env.template')

const ensureEnvFile = () => {
  if (existsSync(envPath)) {
    return true
  }

  if (!existsSync(templatePath)) {
    console.error(`[DEV] Error: Neither .env nor .env.template found in ${__dirname}`)
    console.error('[DEV] Please create a .env file or .env.template file.')
    process.exit(1)
  }

  console.log('[DEV] .env not found, creating from .env.template...')
  copyFileSync(templatePath, envPath)
  console.log('[DEV] Created .env file. Please edit it with your actual values (including secrets).')
  console.log('[DEV] The .env file is gitignored and can contain secrets.')
  return false
}

const loadEnvFile = () => {
  const envContent = readFileSync(envPath, 'utf-8')

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, equalIndex).trim()
    const value = trimmed.slice(equalIndex + 1).trim()
    const unquoted = value.replace(/^["']|["']$/g, '')

    if (key && !process.env[key]) {
      process.env[key] = unquoted
    }
  }

  console.log(`[DEV] Loaded environment variables from ${envPath}`)
}

if (!ensureEnvFile()) {
  process.exit(0)
}

loadEnvFile()

const [command = 'npm', ...args] = process.argv.slice(2)
const commandArgs = args.length > 0 ? args : ['start']

const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
