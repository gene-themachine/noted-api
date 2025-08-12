# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a note-taking API built with AdonisJS 6 that provides backend services for a note-taking application with study features including flashcards and multiple choice questions.

## Common Development Commands

### Development

```bash
npm run dev          # Start development server with hot-reload
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
node ace migration:rollback  # Rollback last migration
node ace migration:fresh     # Drop all tables and re-run migrations
node ace migration:status    # Check migration status
```

### Testing Individual Files

```bash
node ace test tests/unit/example.spec.ts    # Run specific unit test
node ace test tests/functional/example.spec.ts    # Run specific functional test
```

## Architecture Overview

### Framework & Core Technologies

- **AdonisJS 6**: Modern Node.js framework with TypeScript support
- **PostgreSQL**: Primary database via Lucid ORM
- **Redis**: Used for queuing (BullMQ) and SSE connections
- **AWS S3**: File storage for library items

### Key Architectural Patterns

#### 1. Service-Oriented Architecture

- **Controllers** in `app/controllers/` handle HTTP requests and responses only
- **Services** in `app/services/` contain all business logic and data operations
- **Models** in `app/models/` use Lucid ORM with decorators for data access
- Clean separation of concerns between HTTP layer and business logic

#### 2. Service Layer Structure

- **AuthorizationService**: Centralized access control and permission checks
- **ProjectService**: Project and folder tree management operations
- **NoteService**: Note CRUD operations and study options management
- **FlashcardService**: Flashcard generation, status tracking, and management
- **MultipleChoiceService**: Multiple choice quiz creation and management
- **LibraryService**: File upload, storage, and library item operations
- **QueueService**: Centralized queue job management for async processing
- **SseManager**: Real-time communication via Server-Sent Events

#### 3. Authentication & Authorization

- Token-based auth using AdonisJS Auth module
- Auth middleware applied to protected routes
- **AuthorizationService** provides centralized access control
- Consistent permission checking across all operations
- Special SSE route handles auth via query parameter

#### 4. Queue System

- Uses BullMQ for async processing
- **QueueService** centralizes all queue operations
- Flashcard and multiple choice generation delegated to microservices
- Internal endpoints receive callbacks when generation completes
- Proper retry logic and error handling

#### 5. Real-time Updates

- Server-Sent Events (SSE) for live updates
- Managed through `SseManager` service (singleton)
- Used for flashcard/quiz generation progress
- Services broadcast updates via SSE for real-time user feedback

### Data Model Relationships

```
User
├── Projects (1:N)
│   ├── Notes (1:N)
│   │   ├── LibraryItems (1:N)
│   │   ├── Flashcards (1:N)
│   │   ├── MultipleChoiceSets (1:N)
│   │   └── StudyOptions (1:1)
│   └── Workflows (1:N)
└── LibraryItems (global items)
```

### Key Implementation Details

#### Import Aliases

The project uses import aliases defined in `package.json`:

- `#controllers/*` → `./app/controllers/*.js`
- `#models/*` → `./app/models/*.js`
- `#services/*` → `./app/services/*.js`
- `#middleware/*` → `./app/middleware/*.js`

#### Folder Structure

Notes support a folder hierarchy stored as JSON in the project's `folderStructure` field. The structure is managed through tree manipulation in the NotesController.

#### Async Content Generation

1. Client requests flashcard/quiz generation
2. API queues job and returns immediately
3. Microservice processes content
4. Microservice calls internal endpoint with results
5. API updates database and notifies client via SSE

#### Study Options

Each note has configurable study options that determine which study methods are available. Options are stored as comma-separated values in the StudyOptions model.

### Using the Service Layer

#### Controller Responsibilities

- HTTP request/response handling only
- Input validation using Vine validators
- Error handling and status code responses
- Instantiate services in constructor
- Keep methods thin - delegate to services

#### Service Responsibilities

- All business logic and data operations
- Database queries and model interactions
- Access control and authorization checks
- Real-time updates via SSE
- Queue job management
- Complex calculations and transformations

#### Best Practices

- Services should throw meaningful errors, controllers catch and convert to HTTP responses
- Use AuthorizationService for all permission checks
- Services can call other services but avoid circular dependencies
- Keep services focused - single responsibility principle
- All async operations should use proper error handling

### Environment Variables

Key variables required:

- `DB_*`: PostgreSQL connection details
- `APP_KEY`: Application encryption key
- `AWS_*`: S3 credentials for file storage
- `REDIS_*`: Redis connection for queues
