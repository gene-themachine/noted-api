import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { jwksService } from '#services/jwks_service'

/**
 * SupabaseAuthMiddleware
 * - Verifies Supabase JWT (from Authorization header or ?auth_token for SSE)
 * - Uses centralized JWKS service for ES256-only verification
 * - Attaches ctx.userId and ctx.user for downstream controllers/services
 */
export default class SupabaseAuthMiddleware {
  private isDevelopment = env.get('NODE_ENV') === 'development'

  private getToken(ctx: HttpContext): string | null {
    // Prefer Authorization header
    const auth = ctx.request.header('authorization') || ctx.request.header('Authorization')
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice('Bearer '.length)
    }
    // Fallback for SSE: query param 'auth_token'
    const token = ctx.request.qs().auth_token
    return typeof token === 'string' && token.length > 0 ? token : null
  }

  public async handle(ctx: HttpContext, next: () => Promise<void>) {
    try {
      const token = this.getToken(ctx)
      if (!token) {
        if (this.isDevelopment) {
          console.error(
            '❌ Auth failed: No token found in Authorization header or auth_token query param'
          )
        }
        return ctx.response.unauthorized({ message: 'Missing bearer token' })
      }

      // Use centralized JWKS service for verification
      const { user, userId } = await jwksService.verifyTokenAndGetUser(token)

      // Attach to context
      ;(ctx as any).userId = userId
      ;(ctx as any).user = user
      ;(ctx.request as any).userId = userId
      ;(ctx.request as any).user = user

      await next()
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown auth error'

      // Only log in development to reduce production noise
      if (this.isDevelopment) {
        console.error('❌ Supabase auth failed:', errorMsg)
      }

      // Provide more specific error messages based on the error type
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
