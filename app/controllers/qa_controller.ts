import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import NativeQAService from '#services/native_qa_service'
import IntelligentQAService from '#services/intelligent_qa_service'
import { jwksService } from '#services/jwks_service'

const generateQAValidator = vine.compile(
  vine.object({
    qaBlockId: vine.string(),
    question: vine.string().minLength(1),
  })
)

export default class QAController {
  private qaService: NativeQAService
  private intelligentQAService: IntelligentQAService

  constructor() {
    this.qaService = new NativeQAService()
    this.intelligentQAService = new IntelligentQAService()
  }

  /**
   * Generate an answer for a question in a note
   */
  async generate({ params, request, response }: HttpContext) {
    const userId = (request as any)?.userId
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
  async stream({ params, request, response }: HttpContext) {
    const userId = (request as any)?.userId
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
   * Stream Q&A generation using Server-Sent Events (auth handled by middleware)
   */
  async streamSSE({ params, request, response }: HttpContext) {
    const { noteId } = params

    // Validate request parameters from query string
    const qaBlockId = request.qs().qaBlockId as string
    const question = request.qs().question as string
    const authToken = request.qs().auth_token as string

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

    // Manual JWT authentication for SSE endpoints
    let userId: string
    try {
      const { userId: authenticatedUserId } = await jwksService.verifyTokenAndGetUser(authToken)
      userId = authenticatedUserId
    } catch (error: any) {
      console.error('❌ Authentication failed:', error.message)
      response.response.writeHead(401, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      response.response.write(
        `data: ${JSON.stringify({
          type: 'error',
          data: {
            error: 'Authentication failed',
            message: error.message,
          },
        })}\n\n`
      )
      response.response.end()
      return
    }

    // Set up SSE headers with anti-buffering
    response.response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })
    // Flush headers immediately to establish connection
    response.response.flushHeaders()

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

            const duration = ((Date.now() - startTime) / 1000).toFixed(1)
            console.log(
              `✅ Q&A completed for block: ${qaBlockId} - Response: ${accumulatedAnswer.length} chars (${duration}s)`
            )
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
            qaBlockId,
          },
        })}\n\n`
      )

      response.response.end()
    }
  }

  /**
   * Generate an intelligent answer using intent classification and multi-pipeline routing
   */
  async generateIntelligent({ params, request, response }: HttpContext) {
    const userId = (request as any)?.user?.id || (request as any)?.userId
    const { noteId } = params
    const payload = await request.validateUsing(generateQAValidator)

    try {
      const result = await this.intelligentQAService.generateAnswer(
        noteId,
        userId,
        payload.question
      )

      return response.ok({
        success: true,
        data: {
          qaBlockId: payload.qaBlockId,
          question: payload.question,
          answer: result.answer,
          pipeline_used: result.pipeline_used,
          intent_classification: result.intent_classification,
          confidence: result.confidence,
          sources: result.sources,
        },
      })
    } catch (error) {
      console.error('❌ Intelligent QA generation failed:', error)
      return response.internalServerError({
        success: false,
        message: error.message,
      })
    }
  }

  /**
   * Stream intelligent answer generation (auth handled by middleware)
   */
  async streamIntelligent({ params, request, response }: HttpContext) {
    const { noteId } = params
    const { qaBlockId, question, auth_token: authToken } = request.qs()

    // Validate query parameters
    if (!qaBlockId || !question) {
      console.error('❌ Missing required parameters:', { qaBlockId, question })
      response.response.writeHead(400, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      response.response.write(
        `data: ${JSON.stringify({
          type: 'error',
          data: {
            error: 'Missing qaBlockId or question parameters',
            qaBlockId: qaBlockId || 'unknown',
          },
        })}\n\n`
      )
      response.response.end()
      return
    }

    // Manual JWT authentication for SSE endpoints
    let userId: string
    try {
      const { userId: authenticatedUserId } = await jwksService.verifyTokenAndGetUser(
        authToken as string
      )
      userId = authenticatedUserId
    } catch (error: any) {
      console.error('❌ Authentication failed:', error.message)
      response.response.writeHead(401, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      response.response.write(
        `data: ${JSON.stringify({
          type: 'error',
          data: {
            error: 'Authentication failed',
            message: error.message,
          },
        })}\n\n`
      )
      response.response.end()
      return
    }

    try {
      console.log(`🔄 Starting intelligent streaming Q&A for block: ${qaBlockId}`)

      // Set up SSE (use anti-buffering headers to ensure proxies don't buffer)
      response.response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      })
      // Flush headers immediately to establish connection
      response.response.flushHeaders()

      // Send an initial status event quickly so clients establish the stream
      response.response.write(
        `data: ${JSON.stringify({
          type: 'status',
          data: { status: 'started', qaBlockId },
        })}\n\n`
      )

      // Keep-alive ping to prevent timeouts while classifying or retrieving
      const keepAlive = setInterval(() => {
        try {
          response.response.write(
            `data: ${JSON.stringify({ type: 'ping', data: { timestamp: Date.now() } })}\n\n`
          )
        } catch {}
      }, 15000)

      // Generate streaming answer
      let completed = false
      const result = await this.intelligentQAService.generateAnswerStreaming(
        noteId,
        userId,
        question,
        (chunk: string, isComplete: boolean) => {
          // Prevent processing after completion
          if (completed) {
            return
          }

          const eventData = JSON.stringify({
            type: 'chunk',
            data: {
              qaBlockId,
              question,
              chunk,
              isComplete,
              timestamp: new Date().toISOString(),
            },
          })

          response.response.write(`data: ${eventData}\n\n`)

          if (isComplete) {
            completed = true
          }
        }
      )

      // After the streaming service resolves, send metadata and end the stream
      if (!completed) {
        // If provider did not send an explicit completion chunk, ensure we close cleanly
        response.response.write(
          `data: ${JSON.stringify({ type: 'complete', data: { qaBlockId, question, isComplete: true } })}\n\n`
        )
      }

      const metadataEvent = JSON.stringify({
        type: 'metadata',
        data: {
          qaBlockId,
          question,
          pipeline_used: result?.pipeline_used,
          intent_classification: result?.intent_classification,
          confidence: result?.confidence,
          sources: result?.sources,
          isMetadata: true,
        },
      })
      response.response.write(`data: ${metadataEvent}\n\n`)

      clearInterval(keepAlive)
      response.response.end()
    } catch (error) {
      console.error('❌ Intelligent streaming QA failed:', error)

      const errorEvent = JSON.stringify({
        qaBlockId: request.qs().qaBlockId,
        question: request.qs().question,
        chunk: 'An error occurred while generating your answer.',
        isComplete: true,
        error: error.message,
        timestamp: new Date().toISOString(),
      })

      try {
        response.response.write(`data: ${errorEvent}\n\n`)
      } catch {}
      response.response.end()
    }
  }
}
