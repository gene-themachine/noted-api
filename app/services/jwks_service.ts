/**
 * JWKS Service
 *
 * Handles JWT authentication using Supabase's JWKS endpoint.
 *
 * Authentication Flow:
 * 1. User logs in via Supabase (frontend)
 * 2. Frontend sends JWT token in request headers
 * 3. This service verifies JWT against Supabase's public keys (JWKS)
 * 4. Creates/retrieves local user record by Supabase UID
 * 5. Attaches userId to request context for authorization
 *
 * Key Features:
 * - ES256 algorithm only (Supabase standard)
 * - Automatic JWKS caching (handled by jose library)
 * - Singleton pattern (single instance across app)
 * - Auto-creates users on first login
 *
 * Used by: SupabaseAuthMiddleware (app/middleware/supabase_auth_middleware.ts)
 */

import { createRemoteJWKSet, jwtVerify } from 'jose'
import env from '#start/env'
import User from '#models/user'
import { JWTPayload } from '#types/auth.types'

export class JWKSService {
  private static instance: JWKSService

  private jwksUrl: string
  private jwks: ReturnType<typeof createRemoteJWKSet>
  private expectedIssuer: string
  private expectedAudience: string
  private isDevelopment: boolean

  private constructor() {
    this.jwksUrl = env.get('SUPABASE_JWKS_URL') as string
    this.jwks = createRemoteJWKSet(new URL(this.jwksUrl))
    this.expectedIssuer = (env.get('SUPABASE_JWT_ISS') as string) || ''
    this.expectedAudience = (env.get('SUPABASE_JWT_AUD') as string) || ''
    this.isDevelopment = env.get('NODE_ENV') === 'development'
  }

  // ========== Public API ==========

  /**
   * Get singleton instance (lazy initialization)
   */
  static getInstance(): JWKSService {
    if (!JWKSService.instance) {
      JWKSService.instance = new JWKSService()
    }
    return JWKSService.instance
  }

  /**
   * Verify JWT token and return payload
   *
   * @param token - JWT token from request header
   * @returns Decoded JWT payload with user claims (sub, email, etc.)
   * @throws Error if token is invalid, expired, or has wrong issuer/audience
   *
   * Note: JWKS caching is automatic (jose library handles it)
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.expectedIssuer || undefined,
        audience: this.expectedAudience || undefined,
        algorithms: ['ES256'],
      })

      // Debug logging (only in development with LOG_LEVEL=debug)
      if (this.isDevelopment && env.get('LOG_LEVEL') === 'debug') {
        console.log('✅ JWT verified:', { sub: payload.sub, email: (payload as any).email })
      }

      return payload as JWTPayload
    } catch (error: any) {
      console.error('❌ JWT verification failed:', {
        error: error.message,
        code: error.code,
        jwksUrl: this.jwksUrl,
      })
      throw error
    }
  }

  /**
   * Verify JWT and get/create local user
   *
   * @param token - JWT token from request
   * @returns Payload, user model, and userId
   * @throws Error if token invalid or missing 'sub' claim
   *
   * Auto-creates user on first login (Supabase UID becomes primary key)
   */
  async verifyTokenAndGetUser(
    token: string
  ): Promise<{ payload: JWTPayload; user: User; userId: string }> {
    const payload = await this.verifyToken(token)
    const supabaseUid = String(payload.sub || '')
    const email = payload.email as string | undefined

    if (!supabaseUid) throw new Error('Invalid token: missing sub claim')

    // Find or create user
    let user = await User.findBy('supabaseUid', supabaseUid)
    if (!user) {
      if (this.isDevelopment) {
        console.log('👤 Creating new user:', { supabaseUid, email })
      }
      user = await User.create({ supabaseUid, email: email || '' })
    }

    return { payload, user, userId: user.id }
  }
}

// Export singleton instance for easy access
export const jwksService = JWKSService.getInstance()
