/**
 * Q&A and RAG Types
 * Types related to question-answering, RAG pipeline, and knowledge retrieval
 */

// QA Response
export interface QAResponse {
  answer: string
  success: boolean
  pipeline_used: 'rag' | 'external'
  confidence: number
}

// Document Context
export interface DocumentContext {
  name: string
  summary: string | null
}

// Available Context
export interface AvailableContext {
  documents: DocumentContext[]
  hasNoteContent: boolean
}
