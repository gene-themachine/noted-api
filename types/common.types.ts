/**
 * Common/Utility Types
 * General-purpose types used across the application
 */

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface TextChunk {
  content: string
  index: number
}

export interface QAData {
  noteId: string
  userId: string
  qaBlockId: string
  question: string
}

export interface QAResponse {
  success: boolean
  answer?: string
  error?: string
}
