/**
 * QA Controller
 *
 * Handles Q&A endpoints:
 * - POST /notes/:noteId/qa - Answer a question (streaming via SSE)
 */

import { HttpContext } from '@adonisjs/core/http'
import QAService from '#services/qa_service'
import { jwksService } from '#services/jwks_service'

export default class QAController {
  private qaService = new QAService()

  /**
   * Stream answer to user's question via Server-Sent Events
   *
   * Query params: ?question=...&auth_token=...&qaBlockId=...
   */
  async stream(ctx: HttpContext) {
    const { noteId } = ctx.params
    const queryParams = ctx.request.qs()
    const question = queryParams.question as string
    const authToken = queryParams.auth_token as string
    const qaBlockId = queryParams.qaBlockId as string

    // Validate params
    if (!question || !authToken || !qaBlockId) {
      return this.sendSSEError(ctx.response, 'Missing required parameters', 400)
    }

    // Authenticate (manual auth required for SSE - EventSource API limitation)
    let userId: string
    try {
      const result = await jwksService.verifyTokenAndGetUser(authToken)
      userId = result.userId
    } catch (error: any) {
      return this.sendSSEError(ctx.response, `Authentication failed: ${error.message}`, 401)
    }

    // Set up SSE stream
    this.setupSSEHeaders(ctx.response)

    // Send initial connection event
    this.sendSSE(ctx.response, 'status', { status: 'started', qaBlockId })

    // Keep connection alive during processing
    const keepAlive = setInterval(() => {
      this.sendSSE(ctx.response, 'ping', { timestamp: Date.now() })
    }, 15000)

    try {
      // Stream the answer
      await this.qaService.answerQuestion(noteId, userId, question, (chunk, isComplete) => {
        this.sendSSE(ctx.response, 'chunk', { chunk, isComplete, qaBlockId })
      })

      // Send completion metadata
      this.sendSSE(ctx.response, 'complete', { qaBlockId })
    } catch (error: any) {
      console.error('❌ QA failed:', error)
      this.sendSSE(ctx.response, 'error', { error: error.message, qaBlockId })
    } finally {
      clearInterval(keepAlive)
      ctx.response.response.end()
    }
  }

  /**
   * Helper: Set up SSE headers
   */
  private setupSSEHeaders(response: HttpContext['response']) {
    response.response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    })
    response.response.flushHeaders()
  }

  /**
   * Helper: Send SSE event
   */
  private sendSSE(response: HttpContext['response'], type: string, data: any) {
    try {
      const message = JSON.stringify({ type, data })
      response.response.write(`data: ${message}\n\n`)
    } catch (error) {
      console.error('Failed to send SSE event:', error)
    }
  }

  /**
   * Helper: Send SSE error and close
   */
  private sendSSEError(response: HttpContext['response'], message: string, status: number) {
    response.response.writeHead(status, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    })
    this.sendSSE(response, 'error', { error: message })
    response.response.end()
  }
}
