import { createRemoteJWKSet, jwtVerify } from 'jose'
import env from '#start/env'
import User from '#models/user'

interface JWKSResponse {
  keys: Array<{
    kty: string
    use?: string
    alg?: string
    kid?: string
    [key: string]: any
  }>
}

interface JWTPayload {
  sub?: string
  email?: string
  iss?: string
  aud?: string
  exp?: number
  iat?: number
  [key: string]: any
}

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

  // Enhanced caching with metadata
  private jwksCache: {
    data: JWKSResponse
    timestamp: number
    fetchCount: number
  } | null = null

  private readonly JWKS_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 1000 // 1 second

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
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      // First check if JWKS endpoint has keys
      const jwksData = await this.fetchJWKS()

      if (!jwksData.keys || jwksData.keys.length === 0) {
        const errorMsg =
          'No keys found in JWKS endpoint. Supabase auth may not be properly configured.'
        if (this.isDevelopment) {
          console.error('❌ JWKS Error:', errorMsg)
          console.error('🔧 Debug info:', {
            jwksUrl: this.jwksUrl,
            issuer: this.expectedIssuer,
            audience: this.expectedAudience,
            tokenPrefix: token.substring(0, 50) + '...',
          })
        }
        throw new Error(errorMsg)
      }

      // ES256-only JWT verification
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.expectedIssuer || undefined,
        audience: this.expectedAudience || undefined,
        algorithms: ['ES256'], // Explicitly support ES256 only
      })

      if (this.isDevelopment) {
        console.log('✅ JWT verified successfully:', {
          sub: payload.sub,
          email: (payload as any).email,
          iss: payload.iss,
          aud: payload.aud,
        })
      }

      return payload as JWTPayload
    } catch (error: any) {
      if (this.isDevelopment) {
        console.error('❌ JWT verification failed:', {
          error: error.message,
          code: error.code,
          name: error.name,
          jwksUrl: this.jwksUrl,
          tokenPrefix: token.substring(0, 50) + '...',
        })
      }
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
   * Get cached JWKS statistics for monitoring
   */
  getCacheStats(): { cached: boolean; age: number; fetchCount: number; ttl: number } {
    if (!this.jwksCache) {
      return { cached: false, age: -1, fetchCount: 0, ttl: this.JWKS_CACHE_TTL }
    }

    const age = Date.now() - this.jwksCache.timestamp
    return {
      cached: true,
      age,
      fetchCount: this.jwksCache.fetchCount,
      ttl: this.JWKS_CACHE_TTL,
    }
  }

  private isJWKSCacheValid(): boolean {
    if (!this.jwksCache) return false
    const now = Date.now()
    return now - this.jwksCache.timestamp < this.JWKS_CACHE_TTL
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async fetchJWKSWithRetry(attempt = 1): Promise<JWKSResponse> {
    try {
      if (this.isDevelopment) {
        console.log(`🔑 Fetching JWKS (attempt ${attempt}/${this.MAX_RETRIES}): ${this.jwksUrl}`)
      }

      const response = await fetch(this.jwksUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AdonisJS-SupabaseAuth/2.0',
        },
      })

      if (!response.ok) {
        throw new Error(`JWKS fetch failed: ${response.status} ${response.statusText}`)
      }

      const jwks = (await response.json()) as JWKSResponse

      if (this.isDevelopment) {
        console.log('🔑 JWKS Response:', {
          url: this.jwksUrl,
          keysCount: jwks.keys?.length || 0,
          keys: jwks.keys?.map((key) => ({
            kty: key.kty,
            alg: key.alg,
            use: key.use,
            kid: key.kid,
          })),
        })
      }

      // Update cache with metadata
      const fetchCount = (this.jwksCache?.fetchCount || 0) + 1
      this.jwksCache = {
        data: jwks,
        timestamp: Date.now(),
        fetchCount,
      }

      return jwks
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        console.warn(
          `❌ JWKS fetch attempt ${attempt} failed, retrying in ${this.RETRY_DELAY}ms...`
        )
        await this.sleep(this.RETRY_DELAY)
        return this.fetchJWKSWithRetry(attempt + 1)
      }

      console.error('❌ JWKS fetch failed after all retries:', error)
      throw error
    }
  }

  private async fetchJWKS(): Promise<JWKSResponse> {
    // Return cached data if valid
    if (this.isJWKSCacheValid()) {
      if (this.isDevelopment) {
        console.log('🔑 Using cached JWKS data')
      }
      return this.jwksCache!.data
    }

    // Fetch fresh data with retry logic
    return this.fetchJWKSWithRetry()
  }
}

// Export singleton instance for easy access
export const jwksService = JWKSService.getInstance()
