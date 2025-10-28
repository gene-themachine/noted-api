/**
 * HTTP Context Type Augmentation
 *
 * Extends AdonisJS HttpContext to include authentication data.
 * This enables type-safe access to auth information throughout controllers.
 *
 * Industry Standard Pattern:
 * - Middleware attaches userId and user to context
 * - Controllers access via ctx.userId and ctx.user
 * - Full TypeScript IntelliSense support
 * - No need for type casting (as any)
 */

import User from '#models/user'

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    /**
     * Authenticated user's ID (UUID)
     * Set by supabaseAuth middleware after JWT verification
     * Guaranteed to exist on all protected routes
     */
    userId?: string

    /**
     * Authenticated user model instance
     * Set by supabaseAuth middleware after JWT verification
     * Includes: id, supabaseUid, email, etc.
     */
    user?: User
  }
}
