/**
 * Authentication & Authorization Types
 * Types related to JWT, JWKS, and authentication
 */

export interface JWKSResponse {
  keys: Array<{
    kty: string
    use?: string
    alg?: string
    kid?: string
    [key: string]: any
  }>
}

export interface JWTPayload {
  sub?: string
  email?: string
  iss?: string
  aud?: string
  exp?: number
  iat?: number
  [key: string]: any
}
