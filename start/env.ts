/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring Redis
  |----------------------------------------------------------
  */
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring AWS S3
  |----------------------------------------------------------
  */
  NOTED_AWS_ACCESS_KEY_ID: Env.schema.string(),
  NOTED_AWS_SECRET_ACCESS_KEY: Env.schema.string(),
  NOTED_AWS_REGION: Env.schema.string(),
  S3_BUCKET_NAME: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring AI services (OpenAI + LangChain)
  |----------------------------------------------------------
  */
  OPENAI_API_KEY: Env.schema.string(),
  DEFAULT_AI_MODEL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring Pinecone vector database
  |----------------------------------------------------------
  */
  PINECONE_API_KEY: Env.schema.string(),
  PINECONE_INDEX: Env.schema.string(),
  PINECONE_ENVIRONMENT: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring RAG system
  |----------------------------------------------------------
  */
  EMBEDDING_MODEL: Env.schema.string.optional(),
  VECTOR_CHUNK_SIZE: Env.schema.number.optional(),
  VECTOR_CHUNK_OVERLAP: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Variables for debugging and development
  |----------------------------------------------------------
  */
  DEBUG_VERBOSE: Env.schema.boolean.optional(),
})
