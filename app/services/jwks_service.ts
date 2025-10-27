import { createRemoteJWKSet, jwtVerify } from 'jose'
import env from '#start/env'
import User from '#models/user'
import { JWTPayload } from '#types/auth.types'

/**
 * Centralized JWKS and JWT verification service
 * Provides consistent ES256-only JWT verification across the application
 */
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

  /**
   * Get singleton instance
   */
  static getInstance(): JWKSService {
    if (!JWKSService.instance) {
      JWKSService.instance = new JWKSService()
    }
    return JWKSService.instance
  }

  /**
   * Verify JWT token and return payload
   * Note: The jose library's createRemoteJWKSet handles JWKS caching automatically:
   * - Fetches JWKS on first use
   * - Caches based on HTTP cache headers
   * - Refetches only when cache expires or key not found
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      // ES256-only JWT verification using jose library's built-in JWKS handling
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.expectedIssuer || undefined,
        audience: this.expectedAudience || undefined,
        algorithms: ['ES256'], // Explicitly support ES256 only
      })

      // Only log in debug mode to reduce noise
      const isVerbose = this.isDevelopment && env.get('LOG_LEVEL') === 'debug'
      if (isVerbose) {
        console.log('✅ JWT verified:', { sub: payload.sub, email: (payload as any).email })
      }

      return payload as JWTPayload
    } catch (error: any) {
      // Always log errors with details for debugging
      console.error('❌ JWT verification failed:', {
        error: error.message,
        code: error.code,
        jwksUrl: this.jwksUrl,
      })
      throw error
    }
  }

  /**
   * Verify JWT token and resolve/create local user
   */
  async verifyTokenAndGetUser(
    token: string
  ): Promise<{ payload: JWTPayload; user: User; userId: string }> {
    const payload = await this.verifyToken(token)
    const supabaseUid = String(payload.sub || '')
    const email = payload.email as string | undefined

    if (!supabaseUid) {
      throw new Error('Invalid token: missing sub claim')
    }

    // Resolve local user by Supabase uid, create if missing
    let user = await User.findBy('supabaseUid', supabaseUid)
    if (!user) {
      if (this.isDevelopment) {
        console.log('👤 Creating new user:', { supabaseUid, email })
      }
      user = await User.create({ supabaseUid, email: email || '' })
    }

    return {
      payload,
      user,
      userId: user.id,
    }
  }

  /**
   * Get Supabase configuration summary for debugging
   */
  getSupabaseConfig(): Record<string, any> {
    return {
      jwksUrl: this.jwksUrl,
      issuer: this.expectedIssuer,
      audience: this.expectedAudience || 'authenticated',
      jwksUrlValid: this.isValidUrl(this.jwksUrl),
      issuerValid: this.isValidUrl(this.expectedIssuer),
    }
  }

  private isValidUrl(str: string): boolean {
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }
}

// Export singleton instance for easy access
export const jwksService = JWKSService.getInstance()
