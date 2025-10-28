/**
 * Controller Helpers
 *
 * Shared utility functions for all controllers.
 * Reduces code duplication and centralizes common patterns.
 */

import type { HttpContext } from '@adonisjs/core/http'

/**
 * Extract user ID from HTTP context
 *
 * Industry Standard Pattern:
 * - Middleware attaches userId to ctx
 * - Controllers extract with this helper
 * - Throws if missing (indicates middleware not applied)
 *
 * @throws Error if userId not found (auth middleware not applied or failed)
 */
export function getUserId(ctx: HttpContext): string {
  const userId = ctx.userId

  if (!userId) {
    throw new Error('Unauthorized: userId not found in context')
  }

  return userId
}

/**
 * Check if error message indicates a "not found" condition
 * Used for consistent error response handling
 */
export function isNotFoundError(error: any): boolean {
  return error.message?.includes('not found') || error.code === 'E_ROW_NOT_FOUND'
}

/**
 * Check if error message indicates a permission/access issue
 */
export function isPermissionError(error: any): boolean {
  return (
    error.message?.includes('permission') ||
    error.message?.includes('access denied') ||
    error.message?.includes('access')
  )
}

/**
 * Check if error message indicates an AWS/S3 configuration issue
 */
export function isAWSError(error: any): boolean {
  return error.message?.includes('credentials') || error.message?.includes('AWS')
}
