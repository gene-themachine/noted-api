/**
 * Test bootstrap file
 * Sets up the testing environment for Japa tests
 */

import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import type { Config } from '@japa/runner/types'

/**
 * Runner hooks to execute before and after running tests
 */
export const runnerHooks: Pick<Config, 'setup' | 'teardown'> = {
  /**
   * Setup hooks run before starting the test runner
   */
  setup: [
    async () => {
      // Add any global test setup here
      // For example: seeding the database, clearing cache, etc.
    },
  ],

  /**
   * Teardown hooks run after all tests have finished
   */
  teardown: [
    async () => {
      // Add any global cleanup here
      // For example: closing database connections, clearing test data, etc.
    },
  ],
}

/**
 * Configure plugins for Japa
 */
export const plugins: Config['plugins'] = [assert(), apiClient()]

/**
 * Test suites configuration
 */
export const testSuites = [
  {
    name: 'unit',
    files: ['tests/unit/**/*.spec.ts'],
  },
  {
    name: 'functional',
    files: ['tests/functional/**/*.spec.ts'],
  },
]
