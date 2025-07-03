import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'

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

  async register({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(AuthController.registerValidator)
      const user = await User.create(payload)
      // Optionally log the user in immediately after registration
      // const token = await User.accessTokens.create(user)
      // return response.created({ type: 'bearer', token: token.value!.release() })
      return response.created({
        message: 'Registration successful!',
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          username: user.username,
        },
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.status(422).send(error.messages)
      }
      // Handle potential unique constraint errors (e.g., email already exists)
      if (error.code === '23505') {
        // PostgreSQL unique violation code
        return response.status(409).send({ message: 'Email already exists.' })
      }
      console.error('Registration Error:', error)
      return response.internalServerError({ message: 'Could not register user.' })
    }
  }

  // --- User Login ---
  static loginValidator = vine.compile(
    vine.object({
      email: vine.string().email().trim(),
      password: vine.string().trim(),
    })
  )

  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(AuthController.loginValidator)

    try {
      // Verify credentials
      const user = await User.verifyCredentials(email, password)

      // Create API token
      const token = await User.accessTokens.create(user)

      return response.ok({
        message: 'Login successful',
        token: token.value!.release(), // Release sends only the token string
        userId: user.id, // UUID string
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          username: user.username,
        },
      })
    } catch (error) {
      console.error('Login Error:', error.message) // Log specific error
      // Use specific error codes/messages if possible
      if (error.code === 'E_INVALID_CREDENTIALS') {
        return response.unauthorized({ message: 'Invalid email or password.' })
      }
      return response.internalServerError({ message: 'Login failed.' })
    }
  }

  // --- User Logout ---
  async logout({ auth, response }: HttpContext) {
    const user = auth.user!
    try {
      // Get the current token ID used for authentication
      const currentToken = auth.user?.currentAccessToken?.identifier
      if (!currentToken) {
        return response.badRequest({ message: 'No active token found.' })
      }
      // Delete the specific token used for this session
      await User.accessTokens.delete(user, currentToken)
      return response.ok({ message: 'Logged out successfully.' })
    } catch (error) {
      console.error('Logout Error:', error)
      return response.internalServerError({ message: 'Logout failed.' })
    }
  }

  // --- Get Current User ---
  async me({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      return response.ok({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          username: user.username,
          createdAt: user.createdAt,
        },
      })
    } catch (error) {
      console.error('Get User Error:', error)
      return response.internalServerError({ message: 'Could not retrieve user data.' })
    }
  }
}
