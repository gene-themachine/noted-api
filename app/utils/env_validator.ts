import env from '#start/env'
import { ValidationResult } from '#types/common.types'

/**
 * Environment Variable Validator
 * Validates required Supabase and other critical configuration at startup
 */
export class EnvironmentValidator {
  private static requiredSupabaseVars = [
    'SUPABASE_JWKS_URL',
    'SUPABASE_JWT_ISS',
    'SUPABASE_JWT_AUD',
  ]

  private static requiredVars = [
    'APP_KEY',
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_DATABASE',
  ]

  private static optionalVars = ['OPENAI_API_KEY', 'PINECONE_API_KEY']

  /**
   * Validate all required environment variables
   */
  static validateEnvironment(): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check required Supabase configuration
    for (const varName of this.requiredSupabaseVars) {
      const value = env.get(varName)
      if (!value) {
        errors.push(`Missing required Supabase environment variable: ${varName}`)
      } else if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`Invalid Supabase environment variable: ${varName} must be a non-empty string`)
      }
    }

    // Validate Supabase JWKS URL format
    const jwksUrl = env.get('SUPABASE_JWKS_URL') as string
    if (jwksUrl) {
      try {
        const url = new URL(jwksUrl)
        if (!url.pathname.includes('/.well-known/jwks.json')) {
          warnings.push('SUPABASE_JWKS_URL should point to /.well-known/jwks.json endpoint')
        }
      } catch {
        errors.push('SUPABASE_JWKS_URL must be a valid URL')
      }
    }

    // Validate JWT issuer format
    const issuer = env.get('SUPABASE_JWT_ISS') as string
    if (issuer) {
      try {
        new URL(issuer)
      } catch {
        errors.push('SUPABASE_JWT_ISS must be a valid URL')
      }
    }

    // Check other required variables
    for (const varName of this.requiredVars) {
      const value = env.get(varName)
      if (!value) {
        errors.push(`Missing required environment variable: ${varName}`)
      }
    }

    // Check optional but important variables
    for (const varName of this.optionalVars) {
      const value = env.get(varName)
      if (!value) {
        warnings.push(`Optional environment variable not set: ${varName}`)
      }
    }

    // Validate NODE_ENV
    const nodeEnv = env.get('NODE_ENV')
    if (!nodeEnv || !['development', 'production', 'test'].includes(nodeEnv)) {
      warnings.push('NODE_ENV should be set to "development", "production", or "test"')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate and log results at startup
   * Throws error if validation fails in production
   */
  static validateAndLog(): void {
    const result = this.validateEnvironment()
    const nodeEnv = env.get('NODE_ENV')
    const isProduction = nodeEnv === 'production'

    if (result.warnings.length > 0) {
      console.warn('⚠️  Environment validation warnings:')
      result.warnings.forEach((warning) => console.warn(`   - ${warning}`))
    }

    if (result.errors.length > 0) {
      console.error('❌ Environment validation failed:')
      result.errors.forEach((error) => console.error(`   - ${error}`))

      if (isProduction) {
        throw new Error(
          `Environment validation failed with ${result.errors.length} errors. Check logs above.`
        )
      } else {
        console.error('🔧 Development mode: Continuing despite validation errors.')
      }
    } else {
      console.log('✅ Environment validation passed')
      if (result.warnings.length === 0) {
        console.log('✅ All optional variables configured')
      }
    }
  }

  /**
   * Get Supabase configuration summary for debugging
   */
  static getSupabaseConfig(): Record<string, any> {
    const jwksUrl = env.get('SUPABASE_JWKS_URL') as string
    const issuer = env.get('SUPABASE_JWT_ISS') as string
    const audience = env.get('SUPABASE_JWT_AUD') as string

    return {
      jwksUrl,
      issuer,
      audience: audience || 'authenticated',
      jwksUrlValid: jwksUrl ? this.isValidUrl(jwksUrl) : false,
      issuerValid: issuer ? this.isValidUrl(issuer) : false,
    }
  }

  private static isValidUrl(str: string): boolean {
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }
}
