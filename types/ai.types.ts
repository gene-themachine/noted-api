/**
 * AI Generation Types
 * Types related to AI-powered content generation (flashcards, multiple choice, free response)
 */

// Generation Data Types
export interface FlashcardGenerationData {
  flashcardSetId: string
  userId: string
  projectId: string
  selectedNoteIds: string[]
  selectedLibraryItemIds: string[]
}

export interface MultipleChoiceGenerationData {
  multipleChoiceSetId: string
  userId: string
  projectId: string
  selectedNoteIds: string[]
  selectedLibraryItemIds: string[]
}

export interface FreeResponseGenerationData {
  freeResponseSetId: string
  userId: string
  projectId: string
  selectedNoteIds: string[]
  selectedLibraryItemIds: string[]
}

// Response Types
export interface FlashcardResponse {
  flashcards: Array<{
    term: string
    definition: string
  }>
}

export interface MultipleChoiceResponse {
  questions: Array<{
    question: string
    answer: string
  }>
}
