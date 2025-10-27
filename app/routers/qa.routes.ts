import router from '@adonisjs/core/services/router'

const QAController = () => import('#controllers/qa_controller')

/**
 * Q&A routes - handles question answering with RAG (Retrieval-Augmented Generation)
 * Includes both standard REST endpoints and SSE streaming endpoints
 */

/**
 * Protected Q&A routes (require authentication middleware)
 * These use standard HTTP requests with Authorization header
 */
export function registerProtectedQARoutes() {
  // Standard RAG Q&A generation
  router.post('/notes/:noteId/qa/generate', [QAController, 'generate'])

  // Intelligent Q&A with intent classification (RAG/External/Hybrid)
  router.post('/notes/:noteId/qa/intelligent', [QAController, 'generateIntelligent'])
}

/**
 * Public SSE Q&A streaming routes (manual authentication)
 * These routes are NOT protected by middleware because:
 * 1. SSE connections in browsers don't support custom headers (like Authorization)
 * 2. Authentication is handled manually via ?auth_token query parameter
 * 3. Allows sending SSE-formatted error messages instead of JSON responses
 */
export function registerPublicQARoutes() {
  // Standard RAG Q&A streaming
  router.get('/notes/:noteId/qa/stream', [QAController, 'streamSSE'])

  // Intelligent Q&A streaming with intent classification
  router.get('/notes/:noteId/qa/intelligent/stream', [QAController, 'streamIntelligent'])
}
