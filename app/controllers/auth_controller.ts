import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

export default class AuthController {
  // --- User Registration ---
  static registerValidator = vine.compile(
    vine.object({
      email: vine.string().email().trim(),
      password: vine.string().minLength(8).confirmed(), // Requires password_confirmation field
      firstName: vine.string().trim(),
      username: vine.string().trim(),
    })
  )

  async register({ response }: HttpContext) {
    // Handled by Supabase Auth on the frontend
    return response.methodNotAllowed({ message: 'Use Supabase Auth for registration' })
  }

  // --- User Login ---
  static loginValidator = vine.compile(
    vine.object({
      email: vine.string().email().trim(),
      password: vine.string().trim(),
    })
  )

  async login({ response }: HttpContext) {
    // Handled by Supabase Auth on the frontend
    return response.methodNotAllowed({ message: 'Use Supabase Auth to sign in' })
  }

  // --- User Logout ---
  async logout({ response }: HttpContext) {
    // Supabase manages session client-side; invalidate there
    return response.ok({ message: 'Logout via Supabase client on the frontend' })
  }

  // --- Get Current User ---
  async me({ request, response }: HttpContext) {
    try {
      const user = (request as any).user || { id: (request as any).userId }
      return response.ok({ user })
    } catch (error) {
      return response.internalServerError({ message: 'Could not retrieve user data.' })
    }
  }
}
