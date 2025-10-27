/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
| All route definitions have been moved to app/routers/ for better organization.
|
| Route Structure:
| - app/routers/index.ts                  → Main router entry point
| - app/routers/projects.routes.ts        → Project management routes
| - app/routers/notes.routes.ts           → Note CRUD and folder operations
| - app/routers/qa.routes.ts              → Q&A with RAG (REST + SSE streaming)
| - app/routers/flashcards.routes.ts      → Flashcard sets and starred items
| - app/routers/multiple_choice.routes.ts → Multiple choice sets
| - app/routers/free_response.routes.ts   → Free response sets and evaluations
| - app/routers/libraries.routes.ts       → Document uploads and vectorization
| - app/routers/todos.routes.ts           → Todo CRUD operations
| - app/routers/health.routes.ts          → Health check endpoints
|
*/

import { registerRoutes } from '#routers/index'

// Register all application routes
registerRoutes()
