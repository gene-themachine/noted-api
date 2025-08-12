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

export interface FlashcardResponse {
  flashcards: Array<{
    term: string
    definition: string
  }>
}
