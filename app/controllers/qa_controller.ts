import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import NativeQAService from '#services/native_qa_service'

const generateQAValidator = vine.compile(
  vine.object({
    qaBlockId: vine.string(),
    question: vine.string().minLength(1),
  })
)

export default class QAController {
  private qaService: NativeQAService

  constructor() {
    this.qaService = new NativeQAService()
  }

  /**
   * Generate an answer for a question in a note
   */
  async generate({ auth, params, request, response }: HttpContext) {
    const userId = auth.user!.id
    const { noteId } = params
    const payload = await request.validateUsing(generateQAValidator)

    try {
      const result = await this.qaService.generateQA({
        noteId,
        userId,
        qaBlockId: payload.qaBlockId,
        question: payload.question,
      })

      if (result.success && result.answer) {
        return response.ok({
          success: true,
          data: {
            qaBlockId: payload.qaBlockId,
            question: payload.question,
            answer: result.answer,
          },
        })
      } else {
        return response.badRequest({
          success: false,
          message: result.error || 'Failed to generate answer',
        })
      }
    } catch (error) {
      console.error('❌ Q&A generation error:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Failed to generate Q&A',
      })
    }
  }

  /**
   * Stream Q&A generation using Server-Sent Events
   */
  async stream({ auth, params, request, response }: HttpContext) {
    const userId = auth.user!.id
    const { noteId } = params
    const payload = await request.validateUsing(generateQAValidator)

    // Set up SSE headers
    response.response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    let accumulatedAnswer = ''

    try {
      console.log(`🔄 Starting streaming Q&A for block: ${payload.qaBlockId}`)

      // Send initial status
      response.response.write(
        `data: ${JSON.stringify({
          type: 'status',
          data: { status: 'started', qaBlockId: payload.qaBlockId },
        })}\n\n`
      )

      await this.qaService.generateQAStreaming(
        {
          noteId,
          userId,
          qaBlockId: payload.qaBlockId,
          question: payload.question,
        },
        (chunk: string, isComplete: boolean) => {
          if (chunk) {
            accumulatedAnswer += chunk
            // Send chunk to client
            response.response.write(
              `data: ${JSON.stringify({
                type: 'chunk',
                data: {
                  chunk,
                  accumulatedAnswer,
                  qaBlockId: payload.qaBlockId,
                },
              })}\n\n`
            )
          }

          if (isComplete) {
            // Send completion message
            response.response.write(
              `data: ${JSON.stringify({
                type: 'complete',
                data: {
                  answer: accumulatedAnswer,
                  qaBlockId: payload.qaBlockId,
                },
              })}\n\n`
            )

            console.log(`✅ Streaming Q&A completed for block: ${payload.qaBlockId}`)
            response.response.end()
          }
        }
      )
    } catch (error) {
      console.error('❌ Streaming Q&A error:', error)

      // Send error message
      response.response.write(
        `data: ${JSON.stringify({
          type: 'error',
          data: {
            error: error.message || 'Failed to generate Q&A',
            qaBlockId: payload.qaBlockId,
          },
        })}\n\n`
      )

      response.response.end()
    }
  }

  /**
   * Stream Q&A generation using Server-Sent Events (with manual auth handling)
   */
  async streamSSE({ params, request, response, auth }: HttpContext) {
    console.log('🔄 SSE Q&A endpoint called')
    console.log('📝 Query params:', request.qs())
    console.log('📝 Params:', params)

    // Manual authentication via query parameter
    const authToken = request.qs().auth_token as string
    if (!authToken) {
      console.error('❌ No auth token provided')
      response.response.writeHead(401, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      response.response.write(
        `data: ${JSON.stringify({
          type: 'error',
          data: { error: 'Authentication token required', qaBlockId: 'unknown' },
        })}\n\n`
      )
      response.response.end()
      return
    }

    // Validate request parameters from query string
    const qaBlockId = request.qs().qaBlockId as string
    const question = request.qs().question as string

    if (!qaBlockId || !question) {
      response.response.writeHead(400, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      response.response.write(
        `data: ${JSON.stringify({
          type: 'error',
          data: { error: 'qaBlockId and question are required', qaBlockId: qaBlockId || 'unknown' },
        })}\n\n`
      )
      response.response.end()
      return
    }

    // Verify the authentication token manually
    let userId: string
    try {
      console.log('🔐 Verifying auth token...')

      // Set up the authorization header for the auth system
      request.request.headers.authorization = `Bearer ${authToken}`

      // Use the auth system to authenticate
      await auth.authenticateUsing(['api'])
      const user = auth.user

      if (!user) {
        console.error('❌ Authentication failed - no user found')
        response.response.writeHead(401, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })
        response.response.write(
          `data: ${JSON.stringify({
            type: 'error',
            data: { error: 'Authentication failed', qaBlockId },
          })}\n\n`
        )
        response.response.end()
        return
      }

      userId = user.id
      console.log(`✅ Token verified for user: ${userId}`)
    } catch (error) {
      console.error('❌ Token verification failed:', error)
      response.response.writeHead(401, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      response.response.write(
        `data: ${JSON.stringify({
          type: 'error',
          data: { error: 'Authentication failed', qaBlockId },
        })}\n\n`
      )
      response.response.end()
      return
    }

    const { noteId } = params

    // Set up SSE headers with anti-buffering
    response.response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    let accumulatedAnswer = ''
    const startTime = Date.now()

    try {
      console.log(`🔄 Starting streaming Q&A for block: ${qaBlockId}`)

      // Send initial status
      response.response.write(
        `data: ${JSON.stringify({
          type: 'status',
          data: { status: 'started', qaBlockId },
        })}\n\n`
      )

      await this.qaService.generateQAStreaming(
        {
          noteId,
          userId,
          qaBlockId,
          question,
        },
        (chunk: string, isComplete: boolean) => {
          if (chunk) {
            accumulatedAnswer += chunk
            // Send chunk to client
            response.response.write(
              `data: ${JSON.stringify({
                type: 'chunk',
                data: {
                  chunk,
                  accumulatedAnswer,
                  qaBlockId,
                },
              })}\n\n`
            )
          }

          if (isComplete) {
            // Send completion message
            response.response.write(
              `data: ${JSON.stringify({
                type: 'complete',
                data: {
                  answer: accumulatedAnswer,
                  qaBlockId,
                },
              })}\n\n`
            )
            // Completion message sent immediately

            const duration = ((Date.now() - startTime) / 1000).toFixed(1)
            console.log(`✅ Q&A completed for block: ${qaBlockId} - Response: ${accumulatedAnswer.length} chars (${duration}s)`)
            response.response.end()
          }
        }
      )

      // Final result logged above with summary
    } catch (error) {
      console.error('❌ Streaming Q&A error:', error)

      // Send error message
      response.response.write(
        `data: ${JSON.stringify({
          type: 'error',
          data: {
            error: error.message || 'Failed to generate Q&A',
            qaBlockId,
          },
        })}\n\n`
      )
      // Error message sent immediately

      response.response.end()
    }
  }

  /**
   * Simple test endpoint to debug streaming
   */
  async test({ response }: HttpContext) {
    console.log('🧪 Test endpoint called')

    try {
      const testResult = await this.qaService.generateQAStreaming(
        {
          noteId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          qaBlockId: 'test-block-id',
          question: 'What is 2+2?',
        },
        (chunk: string, isComplete: boolean) => {
          console.log('🧪 Test callback received:', { chunk, isComplete })
        }
      )

      console.log('🧪 Test result:', testResult)

      return response.ok({
        success: true,
        message: 'Test completed',
        result: testResult,
      })
    } catch (error) {
      console.error('🧪 Test failed:', error)
      return response.internalServerError({
        success: false,
        error: error.message,
      })
    }
  }
}
