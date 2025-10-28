import router from '@adonisjs/core/services/router'

const QAController = () => import('#controllers/qa_controller')

/**
 * Q&A routes - handles question answering with RAG (Retrieval-Augmented Generation)
 * Includes both standard REST endpoints and SSE streaming endpoints
 */

/**
 * Public SSE Q&A streaming routes (manual authentication via query param)
 *
 * SSE connections in browsers don't support Authorization headers,
 * so authentication is handled via ?auth_token query parameter
 */
export function registerPublicQARoutes() {
  // Stream answer to question with intelligent routing
  router.get('/notes/:noteId/qa/stream', [QAController, 'stream'])
}
