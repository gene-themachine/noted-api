# noted-api

Backend API server for the **Noted** application. Built with AdonisJS 6 and TypeScript, featuring AI-powered study tools and an advanced RAG (Retrieval-Augmented Generation) system for intelligent question-answering.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Development](#development)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Authentication & Authorization](#authentication--authorization)
- [API Documentation](#api-documentation)
- [RAG System](#rag-system)
- [Code Quality](#code-quality)
- [Database Commands](#database-commands)
- [Production Build](#production-build)
- [Troubleshooting](#troubleshooting)

## Overview

This RESTful API server provides comprehensive note-taking, document management, and AI-powered study features including:

- **Projects & Notes**: Hierarchical folder structure with drag-and-drop support
- **Document Management**: PDF upload, storage (S3), and vectorization (Pinecone)
- **AI Study Tools**: Flashcards, multiple choice quizzes, and free response questions
- **Intelligent Q&A**: RAG-based question-answering with intent classification
- **Todo Management**: Simple task tracking per user

## Tech Stack

### Core Framework
- **AdonisJS 6** - Modern Node.js framework with TypeScript
- **Node.js 20+** - JavaScript runtime
- **TypeScript** - Type-safe development

### Database & Storage
- **PostgreSQL 14+** - Primary database with Lucid ORM
- **AWS S3** - File storage for PDFs and documents
- **Pinecone** - Vector database for document embeddings

### Authentication & AI
- **Supabase** - Authentication provider (JWT with JWKS)
- **OpenAI** - GPT-4 completions and text-embedding-3-small

### Validation & Testing
- **@vinejs/vine** - Type-safe input validation
- **Japa** - Test framework with API client plugin

## Prerequisites

- Node.js 20 or higher
- PostgreSQL 14 or higher
- npm or yarn
- AWS account with S3 bucket
- Supabase project for authentication
- Pinecone account with index
- OpenAI API key

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory:

```bash
# ===========================
# Application
# ===========================
APP_KEY=                  # Generate with: node ace generate:key
PORT=3333
NODE_ENV=development
HOST=localhost

# ===========================
# Database
# ===========================
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_DATABASE=noted

# ===========================
# Supabase Authentication
# ===========================
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/jwks
SUPABASE_JWT_ISS=https://your-project.supabase.co/auth/v1
SUPABASE_JWT_AUD=authenticated

# ===========================
# AWS S3 Storage
# ===========================
NOTED_AWS_REGION=us-east-1
NOTED_AWS_ACCESS_KEY_ID=your_access_key_id
NOTED_AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET_NAME=your-bucket-name

# ===========================
# OpenAI
# ===========================
OPENAI_API_KEY=sk-...
DEFAULT_AI_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small

# ===========================
# Pinecone Vector Database
# ===========================
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=noted-index
VECTOR_CHUNK_SIZE=1000
VECTOR_CHUNK_OVERLAP=200
```

### Generate Application Key

```bash
node ace generate:key
```

Copy the generated key to your `.env` file as `APP_KEY`.

## Database Setup

Run migrations to create all database tables:

```bash
node ace migration:run
```

Check migration status:

```bash
node ace migration:status
```

## Development

Start the development server with hot-reload:

```bash
npm run dev
```

The server will start at **http://localhost:3333**

### Development Features

- **Hot Module Replacement (HMR)** - Controllers and middleware reload automatically
- **TypeScript Watch Mode** - Type checking on save
- **Auto-restart** - Server restarts on service/model changes

## Architecture

### Architectural Patterns

The application follows a strict **Service-Oriented Architecture** with clear separation of concerns:

```
Client Request
    ↓
Routes (app/routers/*.routes.ts)
    ↓
Middleware (supabase_auth_middleware.ts)
    ↓
Controllers (app/controllers/*.ts) - HTTP handling only
    ↓
Services (app/services/*.ts) - Business logic
    ↓
Models (app/models/*.ts) - Database layer
    ↓
PostgreSQL / S3 / Pinecone
```

#### Layer Responsibilities

**Controllers** (`app/controllers/`)
- HTTP request/response handling ONLY
- Input validation using Vine validators
- Type-safe context access via `ctx: HttpContext`
- Delegate all business logic to services
- Convert service errors to appropriate HTTP responses

**Services** (`app/services/`)
- All business logic and complex operations
- Database queries and model interactions
- Authorization checks via `AuthorizationService`
- Third-party API integrations (OpenAI, Pinecone, S3)
- Data transformations and calculations

**Models** (`app/models/`)
- Lucid ORM models with TypeScript decorators
- Database schema representation
- Entity relationships (`@hasMany`, `@belongsTo`, etc.)
- Query scopes and lifecycle hooks

**Validators** (`app/validators/`)
- Request payload validation using `@vinejs/vine`
- Type-safe validation schemas
- Custom validation rules

**Middleware** (`app/middleware/`)
- Authentication via Supabase JWT (JWKS verification)
- Request preprocessing
- Response formatting

**Utilities** (`app/utils/`)
- PDF text extraction
- S3 client configuration
- OpenAI API wrapper
- Environment variable validation

**Prompts** (`app/prompts/`)
- AI prompt templates for study tools
- Centralized prompt management
- Consistent AI output formatting

### Core Services

#### Authentication & Authorization
- **`JwksService`** - Supabase JWT verification using JWKS (ES256 algorithm)
- **`AuthorizationService`** - Centralized access control and permission checks

#### Study Features
- **`FlashcardService`** - Flashcard generation, management, and starred collections
- **`MultipleChoiceService`** - Multiple choice quiz creation and management
- **`FreeResponseService`** - Free response questions with AI evaluation

#### RAG & Q&A System
- **`QAService`** - Main Q&A orchestrator with streaming support
- **`NativePineconeService`** - Pinecone vector database operations
- **`NativeVectorService`** - Document vectorization and chunking
- **`ContentFetcherService`** - Retrieves content from notes and library items

#### Content Management
- **`ProjectService`** - Project CRUD and folder tree management (drag-and-drop)
- **`NoteService`** - Note operations and study options configuration
- **`LibraryService`** - File upload, S3 storage, and vectorization
- **`TodoService`** - Simple todo list management

#### AI Integration
- **`AIService`** - OpenAI API wrapper for completions and embeddings

### Database Schema

**49 migrations** define the following core tables:

#### Core Entities
- `users` - User accounts (linked to Supabase UID)
- `projects` - Top-level organizational containers
- `notes` - User notes with rich text content
- `library_items` - PDFs and documents with vectorization status
- `todos` - User task list
- `study_options` - Per-note study tool configuration

#### Study Tools
- `flashcard_sets` - Collections of flashcards
- `flashcards` - Individual flashcard items
- `multiple_choice_sets` - Collections of multiple choice questions
- `multiple_choice_questions` - Individual questions with 4 options
- `free_response_sets` - Collections of free response questions
- `free_responses` - Individual free response questions
- `free_response_evaluations` - AI evaluation history

#### RAG System
- `vector_chunks` - Document chunks with Pinecone vector IDs
- `note_library_items` - Junction table for note-document attachments
- `project_starred_flashcards` - Starred flashcard collections
- `project_starred_multiple_choice_questions` - Starred quiz questions

### Import Aliases

TypeScript import aliases are configured in `package.json`:

```typescript
#controllers/*  → ./app/controllers/*.js
#services/*     → ./app/services/*.js
#models/*       → ./app/models/*.js
#validators/*   → ./app/validators/*.js
#middleware/*   → ./app/middleware/*.js
#utils/*        → ./app/utils/*.js
#config/*       → ./config/*.js
#routers/*      → ./app/routers/*.js
#prompts/*      → ./app/prompts/*.js
```

**Note:** Import paths must use `.js` extension (TypeScript requirement for ESM).

## Project Structure

```
noted-api/
├── app/
│   ├── controllers/              # HTTP request handlers
│   │   ├── helpers.ts            # Shared controller utilities
│   │   ├── todo_controller.ts    # Todo CRUD operations
│   │   ├── qa_controller.ts      # Q&A with SSE streaming
│   │   ├── libraries_controller.ts   # Document upload & management
│   │   ├── notes_controller.ts       # Note CRUD & folders
│   │   ├── project_controller.ts     # Project CRUD & tree management
│   │   └── studyTools/               # Study tool controllers
│   │       ├── helpers.ts            # Study tools utilities
│   │       ├── flashcard_controller.ts
│   │       ├── multiple_choice_controller.ts
│   │       └── free_response_controller.ts
│   │
│   ├── services/                 # Business logic layer
│   │   ├── ai_service.ts         # OpenAI API wrapper
│   │   ├── authorization_service.ts  # Access control
│   │   ├── jwks_service.ts       # JWT verification
│   │   ├── library_service.ts    # File storage & vectorization
│   │   ├── note_service.ts       # Note operations
│   │   ├── project_service.ts    # Project & folder tree
│   │   ├── todo_service.ts       # Todo management
│   │   ├── qa_service.ts         # Q&A orchestration
│   │   ├── content_fetcher_service.ts  # Content retrieval
│   │   ├── native_pinecone_service.ts  # Vector operations
│   │   ├── native_vector_service.ts    # Document vectorization
│   │   └── studyTools/           # Study tool services
│   │       ├── flashcard_service.ts
│   │       ├── multiple_choice_service.ts
│   │       └── free_response_service.ts
│   │
│   ├── models/                   # Lucid ORM models
│   │   ├── user.ts
│   │   ├── project.ts
│   │   ├── note.ts
│   │   ├── library_item.ts
│   │   ├── todo.ts
│   │   ├── study_options.ts
│   │   ├── flashcard_set.ts
│   │   ├── flashcard.ts
│   │   ├── multiple_choice_set.ts
│   │   ├── multiple_choice_question.ts
│   │   ├── free_response_set.ts
│   │   ├── free_response.ts
│   │   ├── free_response_evaluation.ts
│   │   └── vector_chunk.ts
│   │
│   ├── routers/                  # Modular route definitions
│   │   ├── README.md             # Router documentation
│   │   ├── index.ts              # Main router entry point
│   │   ├── health.routes.ts      # Health check
│   │   ├── projects.routes.ts    # Project routes
│   │   ├── notes.routes.ts       # Note routes
│   │   ├── libraries.routes.ts   # Library routes
│   │   ├── todos.routes.ts       # Todo routes
│   │   ├── qa.routes.ts          # Q&A routes
│   │   ├── flashcards.routes.ts  # Flashcard routes
│   │   ├── multiple_choice.routes.ts  # Quiz routes
│   │   └── free_response.routes.ts    # Free response routes
│   │
│   ├── middleware/               # Custom middleware
│   │   ├── supabase_auth_middleware.ts  # JWT authentication
│   │   ├── force_json_response_middleware.ts
│   │   └── container_bindings_middleware.ts
│   │
│   ├── prompts/                  # AI prompt templates
│   │   ├── README.md             # Prompt documentation
│   │   ├── shared.ts             # Shared prompt utilities
│   │   ├── flashcard.ts          # Flashcard generation prompts
│   │   ├── multiple_choice.ts    # Quiz generation prompts
│   │   ├── free_response.ts      # Free response prompts
│   │   └── qa_service_prompts.ts # Q&A system prompts
│   │
│   └── utils/                    # Utility functions
│       ├── env_validator.ts      # Environment validation
│       ├── openai.ts             # OpenAI client config
│       ├── pdf_extractor.ts      # PDF text extraction
│       └── s3.ts                 # S3 client config
│
├── database/
│   └── migrations/               # Database schema migrations (49 files)
│
├── config/                       # App configuration files
│   ├── app.ts
│   ├── auth.ts
│   ├── cors.ts
│   ├── database.ts
│   └── hash.ts
│
├── start/                        # Bootstrap files
│   ├── routes.ts                 # Main routes entry (imports routers)
│   ├── kernel.ts                 # Middleware registration
│   └── env.ts                    # Environment variables
│
├── types/                        # TypeScript type definitions
│   └── http.d.ts                 # HttpContext type augmentation
│
├── tests/                        # Test suite
│   ├── unit/                     # Unit tests
│   └── functional/               # API integration tests
│
├── .env                          # Environment configuration
├── .env.example                  # Environment template
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── adonisrc.ts                   # AdonisJS configuration
├── CLAUDE.md                     # AI assistant guidance
└── README.md                     # This file
```

## Authentication & Authorization

### Supabase JWT Authentication

The API uses **Supabase** for authentication with JWT tokens verified via JWKS:

#### Authentication Flow

1. **Frontend**: User signs up/logs in via Supabase client
2. **Supabase**: Returns JWT access token (ES256 algorithm)
3. **Frontend**: Stores token in localStorage via Supabase session
4. **Frontend**: Includes token in requests: `Authorization: Bearer <token>`
5. **Middleware**: `SupabaseAuthMiddleware` verifies token using JWKS public keys
6. **Middleware**: Attaches `userId` and `user` to `ctx` (type-safe via `types/http.d.ts`)
7. **Controller**: Accesses user via `ctx.userId!` (industry-standard pattern)
8. **Service**: Performs authorization checks via `AuthorizationService`

#### Type-Safe Context Access

All controllers use type-safe context access:

```typescript
// Modern pattern (type-safe with IntelliSense)
async someMethod(ctx: HttpContext) {
  const userId = ctx.userId!  // String, never undefined in protected routes
  const user = ctx.user       // User model instance

  return ctx.response.ok({ data })
}
```

**Type Augmentation** in `types/http.d.ts`:
```typescript
declare module '@adonisjs/core/http' {
  export interface HttpContext {
    userId?: string
    user?: User
  }
}
```

#### SSE Authentication

Server-Sent Events (SSE) endpoints use query parameter authentication because the browser `EventSource` API doesn't support custom headers:

```
GET /notes/:noteId/qa/stream?question=...&auth_token=<jwt>&qaBlockId=...
```

The middleware supports both patterns:
- **Standard routes**: `Authorization: Bearer <token>` header
- **SSE routes**: `?auth_token=<token>` query parameter

### Authorization Pattern

Authorization checks happen in **services** (not controllers):

```typescript
// In service methods
await this.authService.ensureUserOwnsProject(userId, projectId)
await this.authService.ensureUserOwnsNote(userId, noteId)
await this.authService.ensureUserOwnsLibraryItem(userId, libraryItemId)
```

**Security model**: Database queries filter by `userId` for row-level security:

```typescript
const notes = await Note.query()
  .where('user_id', userId)
  .where('project_id', projectId)
```

## API Documentation

### Route Organization

Routes are organized into modular files in `app/routers/`:

#### Protected Routes (require JWT)

All protected routes use the `supabaseAuth()` middleware.

**Projects**
- `GET /projects` - List user's projects
- `POST /projects` - Create new project
- `GET /projects/:id` - Get project details
- `PATCH /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project
- `GET /projects/:id/notes` - Get project notes
- `GET /projects/:id/notes/summary` - Get notes summary
- `GET /projects/:id/tools` - Get project study tools data
- `PATCH /projects/:id/tree/move` - Move node in folder tree
- `PATCH /projects/:id/tree/reorder` - Reorder nodes

**Notes**
- `POST /projects/:projectId/notes` - Create note
- `GET /notes/:id` - Get note by ID
- `PATCH /notes/:id` - Update note
- `DELETE /notes/:id` - Delete note
- `POST /projects/:projectId/folders` - Create folder
- `GET /projects/:projectId/tree` - Get folder tree structure
- `DELETE /folders/:folderId` - Delete folder
- `GET /notes/:noteId/study-options` - Get available study options
- `PATCH /notes/:noteId/study-options` - Update study options
- `POST /notes/:noteId/library-items` - Attach library item to note
- `DELETE /notes/:noteId/library-items/:libraryItemId` - Remove attachment

**Library Items (Documents)**
- `POST /library-items/presigned-url` - Get S3 presigned upload URL
- `POST /library-items/upload` - Create library item record
- `GET /library-items` - Get all user library items
- `GET /projects/:projectId/library-items` - Get project library items
- `GET /library-items/:id` - Get library item by ID
- `GET /library-items/:id/view-url` - Get S3 view URL
- `PATCH /library-items/:id/global-status` - Toggle global status
- `GET /library-items/:id/status` - Get vectorization status

**Flashcards**
- `GET /projects/:projectId/flashcard-sets` - Get all flashcard sets
- `POST /projects/:projectId/flashcard-sets` - Create flashcard set
- `GET /flashcard-sets/:id` - Get flashcard set details
- `PATCH /flashcard-sets/:id` - Update flashcard set name
- `DELETE /flashcard-sets/:id` - Delete flashcard set
- `PATCH /flashcard-sets/:setId/flashcards/mark-update` - Mark cards as needing update
- `GET /projects/:projectId/starred-flashcards` - Get starred flashcards
- `POST /flashcards/:id/star` - Star a flashcard
- `DELETE /flashcards/:id/star` - Unstar a flashcard

**Multiple Choice**
- `GET /projects/:projectId/multiple-choice-sets` - Get all sets
- `POST /projects/:projectId/multiple-choice-sets` - Create set
- `GET /multiple-choice-sets/:id` - Get set details
- `PATCH /multiple-choice-sets/:id` - Update set name
- `DELETE /multiple-choice-sets/:id` - Delete set
- `GET /projects/:projectId/starred-multiple-choice` - Get starred questions
- `POST /multiple-choice-questions/:id/star` - Star a question
- `DELETE /multiple-choice-questions/:id/star` - Unstar a question

**Free Response**
- `GET /projects/:projectId/free-response-sets` - Get all sets
- `POST /projects/:projectId/free-response-sets` - Create set
- `GET /free-response-sets/:id` - Get set details
- `PATCH /free-response-sets/:id` - Update set name
- `DELETE /free-response-sets/:id` - Delete set
- `POST /free-response/:questionId/evaluate` - Evaluate user response with AI
- `GET /free-response/:questionId/evaluations` - Get evaluation history

**Todos**
- `GET /todos` - Get user's todos
- `POST /todos` - Create todo
- `GET /todos/:id` - Get todo by ID
- `PATCH /todos/:id` - Update todo
- `DELETE /todos/:id` - Delete todo
- `PATCH /todos/:id/toggle` - Toggle completion status

#### Public Routes (no auth required)

**Health Check**
- `GET /` - Server health check

**Q&A Streaming (SSE with manual auth)**
- `GET /notes/:noteId/qa/stream` - Stream Q&A answer via SSE
  - Query params: `?question=<text>&auth_token=<jwt>&qaBlockId=<uuid>`

### Response Format

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ]  // Optional validation errors
}
```

**SSE Stream Format:**
```
data: {"type": "status", "data": {"status": "started", "qaBlockId": "..."}}

data: {"type": "chunk", "data": {"chunk": "text...", "isComplete": false}}

data: {"type": "complete", "data": {"qaBlockId": "..."}}
```

## RAG System

The application features an advanced **Retrieval-Augmented Generation** system for intelligent question-answering on documents.

### Document Vectorization Pipeline

```
1. PDF Upload
   ↓
2. S3 Storage (presigned URL)
   ↓
3. Text Extraction (pdf.js in Node.js)
   ↓
4. Chunking (1000 chars with 200 char overlap)
   ↓
5. OpenAI Embeddings (text-embedding-3-small, 1536 dimensions)
   ↓
6. Pinecone Storage (with metadata: userId, projectId, noteId)
   ↓
7. Status: vectorization_status = 'completed'
```

### Vectorization Trigger

Vectorization happens automatically when a library item is **attached to a note**:

```typescript
POST /notes/:noteId/library-items
{
  "libraryItemId": "uuid"
}
```

### Q&A Pipeline

```
User Question
    ↓
Content Fetcher (retrieve text from attached notes/library items)
    ↓
Embed Question (OpenAI text-embedding-3-small)
    ↓
Vector Search (Pinecone similarity search)
    ↓
Top-K Retrieval (most relevant chunks)
    ↓
Context Assembly (combine chunks with metadata)
    ↓
GPT-4 Completion (answer generation with streaming)
    ↓
SSE Stream to Frontend
```

### Security & Access Control

**Multi-layer filtering** ensures users only access their own data:

```typescript
// Pinecone query filters
{
  userId: { $eq: userId },
  projectId: { $eq: projectId },
  noteId: { $eq: noteId }
}
```

### Streaming Responses

Q&A uses Server-Sent Events for real-time streaming:

```typescript
const eventSource = new EventSource(
  `/notes/${noteId}/qa/stream?question=${q}&auth_token=${token}&qaBlockId=${id}`
)

eventSource.addEventListener('message', (event) => {
  const { type, data } = JSON.parse(event.data)

  if (type === 'chunk') {
    // Append chunk.chunk to answer
  } else if (type === 'complete') {
    // Close stream
  }
})
```

### RAG Status Tracking

Library items track vectorization status:

```typescript
vector_status: 'pending' | 'processing' | 'completed' | 'failed'
```

Check status:
```
GET /library-items/:id/status
```

### Configuration

RAG system configuration in `.env`:

```bash
# Vector chunking
VECTOR_CHUNK_SIZE=1000          # Characters per chunk
VECTOR_CHUNK_OVERLAP=200        # Overlap between chunks

# OpenAI
EMBEDDING_MODEL=text-embedding-3-small
DEFAULT_AI_MODEL=gpt-4o

# Pinecone
PINECONE_INDEX=noted-index      # Index name
```

## Code Quality

### TypeScript Type Checking

```bash
npm run typecheck
```

Runs `tsc --noEmit` to check for type errors without building.

### Linting

```bash
npm run lint
```

Runs ESLint with AdonisJS configuration.

### Formatting

```bash
npm run format
```

Formats code with Prettier.

### Testing

```bash
# Run all tests
npm test

# Run specific test file
node ace test tests/unit/example.spec.ts
node ace test tests/functional/example.spec.ts
```

**Test Framework:** Japa with API client plugin

## Database Commands

### Migrations

```bash
# Run pending migrations
node ace migration:run

# Rollback last batch
node ace migration:rollback

# Drop all tables and re-run all migrations
node ace migration:fresh

# Check migration status
node ace migration:status

# Create new migration
node ace make:migration create_table_name
```

### Code Generation

```bash
# Create new model
node ace make:model ModelName

# Create new controller
node ace make:controller ControllerName

# Create new validator
node ace make:validator ValidatorName
```

## Production Build

### Build

```bash
npm run build
```

Compiles TypeScript and creates production bundle in `build/` directory.

### Run Production Server

```bash
npm start
```

Runs the built server from `build/bin/server.js`.

### Production Environment

Ensure the following in production:

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Use strong `APP_KEY` (generate with `node ace generate:key`)
   - Configure production database credentials
   - Use production S3 bucket
   - Use production Pinecone index

2. **Database**
   - Run migrations: `node ace migration:run --force`
   - Set up connection pooling
   - Enable automated backups

3. **Security**
   - Enable HTTPS/TLS
   - Configure CORS properly in `config/cors.ts`
   - Use secure session settings
   - Implement rate limiting (optional)

4. **Process Management**
   - Use PM2, systemd, or Docker
   - Set up logging and monitoring
   - Configure auto-restart on failure

5. **Performance**
   - Enable gzip compression
   - Set up CDN for static assets (if any)
   - Configure database query caching
   - Monitor OpenAI API usage

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready

# List databases
psql -l

# Create database if missing
createdb noted

# Check credentials in .env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_DATABASE=noted
```

### Authentication Failed (401)

1. Check Supabase configuration in `.env`
2. Verify JWKS URL is accessible
3. Test JWT token in browser DevTools > Application > Local Storage
4. Re-login to get fresh token
5. Verify `SUPABASE_JWT_ISS` and `SUPABASE_JWT_AUD` match Supabase project

### Vectorization Failed

1. Check library item status: `GET /library-items/:id/status`
2. Verify PDF uploaded to S3 successfully
3. Check Pinecone API key and index name
4. Check OpenAI API key
5. Review server logs for errors
6. Ensure PDF is text-based (not scanned image)

### TypeScript Errors

```bash
# Run type check
npm run typecheck

# Common issues:
# - Missing .js extension in imports
# - Incorrect import alias (#controllers, #services, etc.)
# - Type mismatches in ctx.userId (use ctx.userId! for non-null assertion)
```

### Hot Reload Not Working

```bash
# Restart dev server
npm run dev

# Clear build cache
rm -rf build/
npm run dev
```

### Import Errors

**Remember:** Import paths must use `.js` extension:

```typescript
// ✅ Correct
import UserService from '#services/user_service.js'

// ❌ Wrong
import UserService from '#services/user_service'
```

### Port Already in Use

```bash
# Find process using port 3333
lsof -i :3333

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3334
```

## License

Proprietary

---

For more detailed information about specific components:
- **CLAUDE.md** - AI assistant development guidance
- **app/routers/README.md** - Router organization and patterns
- **app/prompts/README.md** - AI prompt templates documentation
- **ragService.md** - Detailed RAG system documentation

