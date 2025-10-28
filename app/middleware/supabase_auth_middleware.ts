import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { jwksService } from '#services/jwks_service'

/**
 * Supabase Authentication Middleware
 *
 * Verifies JWT tokens and attaches authenticated user data to the request context.
 *
 * Token Sources (in order of precedence):
 * 1. Authorization header: "Bearer <token>"
 * 2. Query parameter: ?auth_token=<token> (for SSE/EventSource)
 *
 * On Success:
 * - Attaches ctx.userId (string)
 * - Attaches ctx.user (User model instance)
 * - Continues to next middleware/controller
 *
 * On Failure:
 * - Returns 401 Unauthorized with descriptive error message
 */
export default class SupabaseAuthMiddleware {
  private isDevelopment = env.get('NODE_ENV') === 'development'

  /**
   * Extract JWT token from request
   * Supports both Authorization header and query parameter for SSE
   */
  private getToken(ctx: HttpContext): string | null {
    // 1. Try Authorization header (standard HTTP auth)
    const auth = ctx.request.header('authorization') || ctx.request.header('Authorization')
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice('Bearer '.length)
    }

    // 2. Fallback to query param (for SSE/EventSource compatibility)
    const token = ctx.request.qs().auth_token
    return typeof token === 'string' && token.length > 0 ? token : null
  }

  /**
   * Main middleware handler
   * Verifies JWT and attaches user data to context
   */
  public async handle(ctx: HttpContext, next: () => Promise<void>) {
    try {
      // Extract token
      const token = this.getToken(ctx)
      if (!token) {
        if (this.isDevelopment) {
          console.error(
            '❌ Auth failed: No token found in Authorization header or auth_token query param'
          )
        }
        return ctx.response.unauthorized({ message: 'Missing bearer token' })
      }

      // Verify token using JWKS and get/create user
      const { user, userId } = await jwksService.verifyTokenAndGetUser(token)

      // Attach to context (type-safe via types/http.d.ts)
      ctx.userId = userId
      ctx.user = user

      // Continue to controller
      await next()
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown auth error'

      // Log errors in development for debugging
      if (this.isDevelopment) {
        console.error('❌ Supabase auth failed:', errorMsg)
      }

      // Provide specific error messages based on error type
      let responseMessage = 'Invalid or expired token'

      if (errorMsg.includes('No keys found in JWKS')) {
        responseMessage = this.isDevelopment
          ? 'Supabase auth configuration error: No JWT signing keys found'
          : 'Authentication service temporarily unavailable'
      } else if (errorMsg.includes('JWKS fetch failed')) {
        responseMessage = this.isDevelopment
          ? 'Cannot connect to Supabase auth service'
          : 'Authentication service temporarily unavailable'
      } else if (errorMsg.includes('expired')) {
        responseMessage = 'Token expired'
      } else if (errorMsg.includes('audience')) {
        responseMessage = this.isDevelopment ? 'Token audience mismatch' : 'Invalid token'
      } else if (errorMsg.includes('issuer')) {
        responseMessage = this.isDevelopment ? 'Token issuer mismatch' : 'Invalid token'
      }

      return ctx.response.unauthorized({ message: responseMessage })
    }
  }
}
