# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the backend API for **Noted**, a note-taking application with AI-powered study features. Built with AdonisJS 6, it provides services for flashcards, multiple choice quizzes, free response questions, and intelligent question-answering using RAG (Retrieval-Augmented Generation).

## Common Development Commands

### Development

```bash
npm run dev          # Start development server with hot-reload (HMR)
npm run build        # Build for production
npm start            # Start production server
```

### Testing & Quality

```bash
npm test             # Run all tests
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
npm run format       # Format code with Prettier
```

### Database

```bash
node ace migration:run       # Run pending migrations
node ace migration:rollback  # Rollback last migration batch
node ace migration:fresh     # Drop all tables and re-run migrations
node ace migration:status    # Check migration status
node ace make:migration <name>  # Create new migration
```

### Code Generation

```bash
node ace make:controller <name>  # Create new controller
node ace make:model <name>       # Create new Lucid model
node ace make:validator <name>   # Create new Vine validator
node ace make:service <name>     # Create new service (custom command if configured)
```

### Testing Individual Files

```bash
node ace test tests/unit/example.spec.ts        # Run specific unit test
node ace test tests/functional/example.spec.ts  # Run specific functional test
```

## Architecture Overview

### Framework & Core Technologies

- **AdonisJS 6**: Modern Node.js framework with TypeScript support
- **PostgreSQL**: Primary database via Lucid ORM
- **Supabase**: Authentication provider (JWT-based)
- **AWS S3**: File storage for library items (PDFs, documents)
- **Pinecone**: Vector database for document embeddings
- **OpenAI**: Embeddings generation and chat completions
- **Redis**: Not currently in use (removed from queue system)

### Key Architectural Patterns

#### 1. Service-Oriented Architecture

The application follows a strict separation of concerns:

- **Controllers** (`app/controllers/`) - HTTP request/response handling only
  - Validate input using Vine validators
  - Instantiate services in constructor
  - Delegate business logic to services
  - Convert service errors to HTTP responses

- **Services** (`app/services/`) - All business logic and data operations
  - Database queries and model interactions
  - Authorization checks
  - Complex calculations and transformations
  - Third-party API integrations

- **Models** (`app/models/`) - Lucid ORM models with decorators
  - Database schema representation
  - Relationships between entities
  - Query scopes and hooks

- **Validators** (`app/validators/`) - Input validation using @vinejs/vine
  - Request payload validation
  - Type-safe validation schemas
  - Custom validation rules

#### 2. Core Services

**Authorization & Auth:**
- `AuthorizationService` - Centralized access control and permission checks
- `JwksService` - Supabase JWT verification using JWKS (ES256)

**Study Features:**
- `FlashcardService` - Flashcard generation, status tracking, and management
- `MultipleChoiceService` - Multiple choice quiz creation and management
- `FreeResponseService` - Free response question generation and AI evaluation

**RAG & Q&A System:**
- `IntelligentQAService` - Main orchestrator with intent classification
- `IntentClassificationService` - Routes queries to appropriate pipelines
- `NativeQAService` - RAG pipeline using Pinecone vector search
- `ExternalKnowledgeService` - General knowledge queries via GPT
- `HybridQAService` - Combined document + external knowledge
- `NativePineconeService` - Pinecone operations wrapper
- `NativeVectorService` - Document vectorization and chunking

**Content Management:**
- `ProjectService` - Project and folder tree management
- `NoteService` - Note CRUD operations and study options
- `LibraryService` - File upload, storage, and library item operations
- `TodoService` - Todo list management

**AI:**
- `AiService` - OpenAI API wrapper for completions and embeddings

#### 3. Authentication & Authorization

**Supabase JWT Authentication:**
- Frontend handles auth via Supabase client
- Backend verifies JWT tokens using JWKS endpoint
- `SupabaseAuthMiddleware` validates tokens (ES256 algorithm)
- Supports both Authorization header and query parameter (`?auth_token`) for SSE
- User lookup/creation via Supabase UID mapping

**Authorization Pattern:**
```typescript
// In services
await authorizationService.ensureUserOwnsProject(userId, projectId)
await authorizationService.ensureUserOwnsNote(userId, noteId)
```

#### 4. RAG System Architecture

The application features an advanced RAG system with intelligent query routing:

**Document Vectorization Pipeline:**
```
PDF Upload → S3 Storage → Text Extraction (pdf.js) → Chunking (1000 chars)
→ OpenAI Embeddings (text-embedding-3-small) → Pinecone Storage
```

**Intelligent Q&A Pipeline:**
```
User Query → Intent Classification (in-domain/out-of-domain/hybrid)
    ↓
Route to Pipeline:
├── RAG Only: Pinecone Search → Context Retrieval → GPT Answer
├── External Only: General Knowledge via GPT
└── Hybrid: Combined Document + External Knowledge
```

**Key RAG Features:**
- Multi-layer security filtering (userId, projectId, noteId)
- Document attachment-based access control
- Streaming responses via Server-Sent Events (SSE)
- Intent classification determines appropriate pipeline
- Metadata tracking for citations (page numbers, source documents)

**Vectorization Process:**
- Triggered automatically when library items are attached to notes
- Status tracked in `vector_status` field (`pending`, `processing`, `completed`, `failed`)
- Chunks stored in `vector_chunks` table with Pinecone metadata
- Check status via `/libraries/:id/status` endpoint

For detailed RAG documentation:
- `ragService.md` - Core RAG implementation details
- `INTELLIGENT_RAG_IMPLEMENTATION.md` - Intent classification and hybrid pipeline

#### 5. Real-time Updates (SSE)

**Server-Sent Events** for streaming Q&A responses:
- SSE endpoints bypass standard auth middleware
- Use query parameter authentication: `?auth_token=<jwt>`
- Streaming endpoints:
  - `/notes/:noteId/qa/stream` - Standard RAG
  - `/notes/:noteId/qa/intelligent/stream` - Intelligent routing

### Data Model Relationships

```
User (Supabase)
├── Projects (1:N)
│   ├── Notes (1:N)
│   │   ├── NoteLibraryItems (N:M junction)
│   │   ├── StudyOptions (1:1)
│   │   └── VectorChunks (via library items)
│   ├── FlashcardSets (1:N)
│   │   └── Flashcards (1:N)
│   ├── MultipleChoiceSets (1:N)
│   │   └── MultipleChoiceQuestions (1:N)
│   ├── FreeResponseSets (1:N)
│   │   └── FreeResponses (1:N)
│   │       └── FreeResponseEvaluations (1:N)
│   ├── Todos (1:N)
│   ├── Notifications (1:N)
│   └── Workflows (1:N)
│       └── WorkflowLibraryItems (N:M junction)
└── LibraryItems (1:N)
    ├── Global items (shared across projects)
    └── Project-specific items
```

### Key Implementation Details

#### Import Aliases

Defined in `package.json`:
- `#controllers/*` → `./app/controllers/*.js`
- `#services/*` → `./app/services/*.js`
- `#models/*` → `./app/models/*.js`
- `#validators/*` → `./app/validators/*.js`
- `#middleware/*` → `./app/middleware/*.js`
- `#exceptions/*` → `./app/exceptions/*.js`
- `#utils/*` → `./app/utils/*.js`
- `#config/*` → `./config/*.js`
- `#database/*` → `./database/*.js`
- `#start/*` → `./start/*.js`
- `#tests/*` → `./tests/*.js`

#### Folder Structure (Projects)

Notes support a folder hierarchy stored as JSON in `project.folderStructure`. Tree manipulation happens in `ProjectController` with endpoints:
- `PUT /projects/:id/tree/move` - Move node to new parent/folder
- `PUT /projects/:id/tree/reorder` - Reorder siblings

#### Study Options

Each note has configurable study options determining which study methods are available. Options stored as comma-separated string in `StudyOptions` model:
- `flashcards`
- `multipleChoice`
- `freeResponse`

#### Starred Study Items

Projects can star individual flashcards and multiple choice questions for quick review:
- Stored in junction tables: `project_starred_flashcards`, `project_starred_multiple_choice_questions`
- Special "starred" study sets accessible via dedicated endpoints

### Best Practices

#### Controller Responsibilities

- HTTP request/response handling ONLY
- Input validation using Vine validators
- Error handling and HTTP status codes
- Instantiate services in constructor
- Keep methods thin - delegate everything to services

#### Service Responsibilities

- All business logic and data operations
- Database queries and model interactions
- Access control using AuthorizationService
- Third-party API calls (OpenAI, Pinecone, S3)
- Complex calculations and transformations
- Transaction management when needed

#### Error Handling Pattern

```typescript
// In services - throw meaningful errors
if (!note) {
  throw new Error('Note not found')
}

// In controllers - catch and convert to HTTP responses
try {
  const result = await this.noteService.getNote(noteId, userId)
  return response.ok(result)
} catch (error) {
  return response.badRequest({ message: error.message })
}
```

#### Authorization Pattern

```typescript
// Always check authorization in services BEFORE operations
await this.authorizationService.ensureUserOwnsProject(userId, projectId)
await this.authorizationService.ensureUserOwnsNote(userId, noteId)
```

### Environment Variables

Key variables required (see `.env.example`):

**Database:**
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`

**Supabase Auth:**
- `SUPABASE_JWKS_URL` - JWKS endpoint for JWT verification
- `SUPABASE_JWT_ISS` - Expected issuer claim
- `SUPABASE_JWT_AUD` - Expected audience claim

**AWS S3:**
- `NOTED_AWS_ACCESS_KEY_ID`
- `NOTED_AWS_SECRET_ACCESS_KEY`
- `NOTED_AWS_REGION`
- `S3_BUCKET_NAME`

**OpenAI:**
- `OPENAI_API_KEY`
- `DEFAULT_AI_MODEL` - e.g., `gpt-4o`
- `EMBEDDING_MODEL` - e.g., `text-embedding-3-small`

**Pinecone:**
- `PINECONE_API_KEY`
- `PINECONE_INDEX` - Index name
- `VECTOR_CHUNK_SIZE` - Default: 1000
- `VECTOR_CHUNK_OVERLAP` - Default: 200

**Other:**
- `APP_KEY` - Application encryption key (generate with `node ace generate:key`)
- `PORT` - Server port (default: 3333)
- `NODE_ENV` - Environment (`development`, `production`)
- `DEBUG_VERBOSE` - Enable verbose logging (optional)

### Routes Overview

All routes are defined in `start/routes.ts`:

**Auth:**
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user

**Projects:**
- `POST /projects` - Create project
- `GET /projects` - List user's projects
- `GET /projects/:id` - Get project details
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project
- `PUT /projects/:id/tree/move` - Move tree node
- `PUT /projects/:id/tree/reorder` - Reorder nodes
- `GET /projects/:id/notes` - Get all project notes
- `GET /projects/:id/notes/summary` - Get note summaries (lightweight)

**Notes:**
- `POST /notes` - Create note
- `GET /notes/:noteId` - Get note
- `PUT /notes/:noteId` - Update note
- `DELETE /notes/:noteId` - Delete note
- `POST /folders` - Create folder
- `DELETE /projects/:projectId/folders/:folderId` - Delete folder

**Study Sets (Flashcards, Multiple Choice, Free Response):**
- `GET /projects/:projectId/study-sets/{type}` - List sets
- `POST /projects/:projectId/study-sets/{type}` - Create set
- `GET /study-sets/{type}/:setId` - Get set details
- `PUT /study-sets/{type}/:setId` - Update set
- `DELETE /study-sets/{type}/:setId` - Delete set

**Q&A:**
- `POST /notes/:noteId/qa/generate` - Generate answer (standard RAG)
- `POST /notes/:noteId/qa/intelligent` - Generate answer (intelligent routing)
- `GET /notes/:noteId/qa/stream` - SSE streaming (standard)
- `GET /notes/:noteId/qa/intelligent/stream` - SSE streaming (intelligent)

**Library:**
- `POST /libraries/presigned-url` - Get S3 presigned URL for upload
- `POST /libraries/upload` - Create library item record
- `GET /libraries` - List all user's library items
- `GET /libraries/projects/:projectId` - List project library items
- `GET /libraries/:id/status` - Get vectorization status

**Todos:**
- `GET /todos` - List todos
- `POST /todos` - Create todo
- `PUT /todos/:id` - Update todo
- `DELETE /todos/:id` - Delete todo
- `PATCH /todos/:id/toggle` - Toggle completion

All routes except SSE endpoints use `supabaseAuth()` middleware.

## Development Tips

### Hot Module Replacement

The project uses `hot-hook` for HMR on controllers and middleware. Boundaries defined in `package.json`:
```json
"hotHook": {
  "boundaries": [
    "./app/controllers/**/*.ts",
    "./app/middleware/*.ts"
  ]
}
```

### Adding a New Feature

1. **Database**: Create migration with `node ace make:migration <name>`
2. **Model**: Create model in `app/models/`
3. **Service**: Add business logic in `app/services/`
4. **Validator**: Create validator in `app/validators/` (if needed)
5. **Controller**: Add HTTP handling in `app/controllers/`
6. **Routes**: Register in `start/routes.ts`

### Testing Strategy

- Unit tests for services (business logic)
- Functional tests for API endpoints
- Use Japa test runner
- API client plugin for HTTP testing
- Database transactions for test isolation

### Debugging Q&A System

Check these in order:
1. Verify library items are attached to note
2. Check `vector_status` in database (should be `completed`)
3. Verify Pinecone index exists and has vectors
4. Check OpenAI API key is valid
5. Look for errors in console logs
6. Test with `/test/qa` debug endpoint
