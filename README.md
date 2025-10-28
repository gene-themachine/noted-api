# noted-api

Backend API server for the Noted application. Built with AdonisJS 6 and TypeScript.

## Overview

This is a RESTful API server that handles note-taking, document management, and AI-powered study features including flashcards, quizzes, and RAG-based question-answering.

## Tech Stack

- AdonisJS 6 - Node.js framework
- PostgreSQL - Primary database with Lucid ORM
- Supabase - Authentication provider (JWT)
- AWS S3 - File storage
- Pinecone - Vector database for embeddings
- OpenAI - AI completions and embeddings
- TypeScript - Type-safe development

## Prerequisites

- Node.js 20 or higher
- PostgreSQL 14 or higher
- npm or yarn

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_DATABASE=noted

# Supabase Auth
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/jwks
SUPABASE_JWT_ISS=https://your-project.supabase.co/auth/v1
SUPABASE_JWT_AUD=authenticated

# AWS S3
NOTED_AWS_REGION=us-east-1
NOTED_AWS_ACCESS_KEY_ID=your_key
NOTED_AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET_NAME=your-bucket

# OpenAI
OPENAI_API_KEY=sk-...
DEFAULT_AI_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small

# Pinecone
PINECONE_API_KEY=your_key
PINECONE_INDEX=noted-index
VECTOR_CHUNK_SIZE=1000
VECTOR_CHUNK_OVERLAP=200

# App
APP_KEY=generate_with_node_ace_generate_key
PORT=3333
NODE_ENV=development
```

Generate the app key:

```bash
node ace generate:key
```

## Database Setup

Run migrations to create database tables:

```bash
node ace migration:run
```

## Development

Start the development server:

```bash
npm run dev
```

The server will start at http://localhost:3333

## Testing

Run all tests:

```bash
npm test
```

Run specific test file:

```bash
node ace test tests/unit/example.spec.ts
```

## Code Quality

Run ESLint:

```bash
npm run lint
```

Run TypeScript type checking:

```bash
npm run typecheck
```

## Project Structure

```
app/
├── controllers/      # HTTP request handlers
├── services/         # Business logic layer
├── models/           # Lucid ORM models
├── validators/       # Input validation schemas
├── middleware/       # Custom middleware
└── utils/            # Utility functions

database/
└── migrations/       # Database schema migrations

config/               # Application configuration
start/                # Bootstrap and routes
```

## Import Aliases

The following import aliases are configured:

- `#controllers/*` - ./app/controllers/*.js
- `#services/*` - ./app/services/*.js
- `#models/*` - ./app/models/*.js
- `#validators/*` - ./app/validators/*.js
- `#middleware/*` - ./app/middleware/*.js
- `#utils/*` - ./app/utils/*.js
- `#config/*` - ./config/*.js

## Authentication

The API uses Supabase JWT authentication. All protected routes require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

SSE endpoints accept tokens via query parameter:

```
?auth_token=<token>
```

## Database Commands

Run pending migrations:

```bash
node ace migration:run
```

Rollback last migration batch:

```bash
node ace migration:rollback
```

Check migration status:

```bash
node ace migration:status
```

Create new migration:

```bash
node ace make:migration migration_name
```

## Generating Code

Create new model:

```bash
node ace make:model ModelName
```

Create new controller:

```bash
node ace make:controller ControllerName
```

Create new validator:

```bash
node ace make:validator ValidatorName
```

## API Documentation

Main API routes are defined in `start/routes.ts`. Key endpoints include:

- `/projects` - Project management
- `/notes` - Note CRUD operations
- `/library-items` - Document management
- `/flashcard-sets` - Flashcard operations
- `/multiple-choice-sets` - Quiz operations
- `/free-response-sets` - Free response questions
- `/qa` - AI question-answering

## RAG System

The application includes a Retrieval-Augmented Generation system for intelligent question-answering:

1. Documents are uploaded to S3
2. Text is extracted and chunked
3. Chunks are embedded using OpenAI
4. Embeddings stored in Pinecone
5. User queries trigger semantic search
6. Retrieved context used to generate answers

See `ragService.md` for detailed documentation.

## Production Build

Build for production:

```bash
npm run build
```

Run production server:

```bash
npm start
```

## License

Proprietary
