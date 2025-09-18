/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
|
| DO NOT MODIFY THIS FILE AS IT WILL BE OVERRIDDEN DURING THE BUILD
| PROCESS.
|
| See docs.adonisjs.com/guides/typescript-build-process#creating-production-build
|
| Since, we cannot run TypeScript source code using "node" binary, we need
| a JavaScript entrypoint to run ace commands.
|
| This file registers the "ts-node/esm" hook with the Node.js module system
| and then imports the "bin/console.ts" file.
|
*/

/**
 * Register hook to process TypeScript files using ts-node (dev only)
 */
if (process.env.NODE_ENV !== 'production') {
  const candidates = [
    'ts-node-maintained/register/esm',
    'ts-node/register/esm',
    'ts-node/register',
  ]
  let loaded = false
  for (const candidate of candidates) {
    try {
      await import(candidate)
      loaded = true
      break
    } catch {}
  }
  if (!loaded) {
    // No ts-node hook available; will rely on compiled JavaScript if present
  }
}

/**
 * Import ace console entrypoint
 */
await import('./bin/console.js')
