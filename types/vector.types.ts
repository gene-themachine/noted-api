/**
 * Vector Database Types
 * Types related to Pinecone vector operations and embeddings
 */

export interface NativeSearchResult {
  id: string
  score: number
  metadata: Record<string, any>
  content?: string
}

export interface VectorRecord {
  id: string
  values: number[]
  metadata: Record<string, any>
}
