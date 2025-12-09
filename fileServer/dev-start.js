#!/usr/bin/env node

/**
 * Dev-only script to load .env file and start the service.
 * This is NOT used in production - production expects env vars to be set externally.
 * 
 * If .env doesn't exist, it will be created from .env.template.
 */

import { readFileSync, existsSync, copyFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { spawn } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const envPath = join(__dirname, '.env')
const templatePath = join(__dirname, '.env.template')

// Initialize .env from template if it doesn't exist
if (!existsSync(envPath)) {
  if (existsSync(templatePath)) {
    console.log(`[DEV] .env not found, creating from .env.template...`)
    copyFileSync(templatePath, envPath)
    console.log(`[DEV] Created .env file. Please edit it with your actual values (including secrets).`)
    console.log(`[DEV] The .env file is gitignored and can contain secrets.`)
    process.exit(0)
  } else {
    console.error(`[DEV] Error: Neither .env nor .env.template found in ${__dirname}`)
    console.error(`[DEV] Please create a .env file or .env.template file.`)
    process.exit(1)
  }
}

// Load .env file
try {
  const envContent = readFileSync(envPath, 'utf-8')
  
  // Parse .env file (simple key=value parser, handles comments and empty lines)
  const lines = envContent.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue
    
    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) continue
    
    const key = trimmed.slice(0, equalIndex).trim()
    const value = trimmed.slice(equalIndex + 1).trim()
    
    // Remove quotes if present
    const unquoted = value.replace(/^["']|["']$/g, '')
    
    // Only set if not already in process.env (allows override)
    if (key && !process.env[key]) {
      process.env[key] = unquoted
    }
  }
  
  console.log(`[DEV] Loaded environment variables from ${envPath}`)
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`[DEV] Warning: .env file not found at ${envPath}`)
    console.error('[DEV] Create a .env file in this directory for local development')
    process.exit(1)
  } else {
    throw error
  }
}

// Now run the actual service
const child = spawn('npm', ['start'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
})

child.on('exit', (code) => {
  process.exit(code || 0)
})

