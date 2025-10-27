/**
 * Q&A and RAG Types
 * Types related to question-answering, RAG pipeline, and knowledge retrieval
 */

// Intent Classification
export interface IntentClassificationResult {
  intent: 'in_domain' | 'out_of_domain' | 'hybrid'
  confidence: number
  domain_topics?: string[]
  suggested_pipeline: 'rag_only' | 'external_only' | 'hybrid'
  reasoning: string
}

export interface DomainContext {
  noteId: string
  attachedDocuments: string[]
  noteContent?: string
  projectDomain?: string
}

// QA Response Types
export interface IntelligentQAResponse {
  answer: string
  sources: Array<{
    type: 'document' | 'external'
    content: string
    metadata?: any
  }>
  pipeline_used: 'rag_only' | 'external_only' | 'hybrid'
  intent_classification: IntentClassificationResult
  confidence: number
}

export interface HybridQAResponse {
  answer: string
  sources: Array<{
    type: 'document' | 'external'
    content: string
    metadata?: any
  }>
  method: 'hybrid'
  confidence: number
}

export interface ExternalKnowledgeResponse {
  answer: string
  sources: string[]
  confidence: number
  method: 'web_search' | 'general_ai' | 'academic_search'
}

// Search Results
export interface SearchResult {
  title: string
  content: string
  url?: string
  relevance_score: number
}
