/*
|--------------------------------------------------------------------------
| Router Index
|--------------------------------------------------------------------------
|
| Central router configuration that imports and registers all route modules.
| This provides a clean, modular approach to route organization.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Import route modules
import registerProjectRoutes from '#routers/projects.routes'
import registerNotesRoutes from '#routers/notes.routes'
import { registerPublicQARoutes } from '#routers/qa.routes'
import registerFlashcardRoutes from '#routers/flashcards.routes'
import registerMultipleChoiceRoutes from '#routers/multiple_choice.routes'
import registerFreeResponseRoutes from '#routers/free_response.routes'
import registerLibraryRoutes from '#routers/libraries.routes'
import registerTodoRoutes from '#routers/todos.routes'
import registerHealthRoutes from '#routers/health.routes'

/**
 * Main router registration function
 * Organizes routes into authenticated and public groups
 */
export function registerRoutes() {
  // ============================================================================
  // Public Routes (No Authentication Required)
  // ============================================================================

  // Health check endpoint
  registerHealthRoutes()

  // SSE streaming endpoints (manual authentication via query parameter)
  // These MUST be outside middleware because:
  // 1. Browser EventSource API doesn't support custom headers
  // 2. Authentication is handled manually via ?auth_token parameter
  // 3. Allows streaming SSE-formatted errors instead of JSON responses
  registerPublicQARoutes()

  // ============================================================================
  // Protected Routes (Authentication Required)
  // ============================================================================

  router
    .group(() => {
      // Project management
      registerProjectRoutes()

      // Note operations
      registerNotesRoutes()

      // Study tools
      registerFlashcardRoutes()
      registerMultipleChoiceRoutes()
      registerFreeResponseRoutes()

      // Library/Document management
      registerLibraryRoutes()

      // Todo operations
      registerTodoRoutes()
    })
    .use(middleware.supabaseAuth())
}
