/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
| See docs.adonisjs.com/guides/typescript-build-process#creating-production-build
*/

import 'reflect-metadata'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const tsConsolePath = path.join(__dirname, 'bin', 'console.ts')
const jsConsolePath = path.join(__dirname, 'bin', 'console.js')

// Heuristics: if we are building, or JS doesn't exist yet, enable TS runtime
const isBuild = process.argv.slice(2).includes('build')
const hasTsConsole = fs.existsSync(tsConsolePath)
const hasJsConsole = fs.existsSync(jsConsolePath)
const shouldRegisterTs = isBuild || (hasTsConsole && !hasJsConsole) || process.env.FORCE_TS === '1'

// Register a TS loader when needed (even in production during `build`)
if (shouldRegisterTs) {
  const candidates = [
    'ts-node/register/esm',
    'ts-node/register',
    'ts-node-maintained/register/esm',
    'ts-node-maintained/register',
  ]
  let loaded = false
  for (const c of candidates) {
    try {
      await import(c)
      loaded = true
      break
    } catch {}
  }
  if (!loaded) {
    console.warn('[ace] Warning: ts-node not available; expecting compiled JS.')
  }
}

// Import TS during build/source runs; JS after compile
if (shouldRegisterTs && hasTsConsole) {
  await import('./bin/console.ts')
} else {
  await import('./bin/console.js')
}
