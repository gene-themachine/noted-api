/**
 * Flashcard Generation Prompts
 *
 * Used by: FlashcardService (app/services/studyTools/flashcard_service.ts)
 * Purpose: Generate flashcard study materials from note content and PDFs
 *
 * Process:
 * 1. User selects notes/library items to generate flashcards from
 * 2. Content is fetched and combined by ContentFetcherService
 * 3. This prompt asks GPT-4o to generate 8-12 flashcards covering key concepts
 * 4. Response is parsed as JSON and stored in database
 *
 * Model: gpt-4o (configurable via DEFAULT_AI_MODEL env var)
 */

import { FlashcardResponse } from '#types/ai.types'

/**
 * Create flashcard generation prompt
 *
 * @param combinedContent - Combined text from notes and PDF extractions
 * @returns Prompt instructing GPT to generate flashcards in JSON format
 *
 * Output format: { flashcards: [{ term: string, definition: string }, ...] }
 */
export function createFlashcardPrompt(combinedContent: string): string {
  return `
You are an expert educational content creator. Your task is to generate high-quality flashcards from the provided content.

INSTRUCTIONS:
1. Create 8-12 flashcards that cover the most important concepts
2. Each flashcard should have a clear, concise TERM and a comprehensive DEFINITION
3. Focus on key concepts, important facts, definitions, and relationships
4. Make sure definitions are self-contained and educational
5. Vary the types of questions (definitions, concepts, processes, comparisons)
6. Return the flashcards in this exact JSON format:

{
  "flashcards": [
    {
      "term": "Clear, concise term or question",
      "definition": "Comprehensive, educational answer or definition"
    },
    {
      "term": "Another term or concept",
      "definition": "Another clear definition or explanation"
    }
  ]
}

CONTENT TO ANALYZE:
"""
${combinedContent}
"""

Generate the flashcards now:
`
}

export type { FlashcardResponse }
