/**
 * Multiple Choice Generation Prompts
 *
 * Used by: MultipleChoiceService (app/services/studyTools/multiple_choice_service.ts)
 * Purpose: Generate multiple choice quiz questions from note content and PDFs
 *
 * Process:
 * 1. User selects notes/library items to generate questions from
 * 2. Content is fetched and combined by ContentFetcherService
 * 3. This prompt asks GPT-4o to generate 10-15 multiple choice questions
 * 4. Each question has 4 choices (A-D) with one correct answer
 * 5. Response is parsed as JSON and stored in database
 *
 * Model: gpt-4o (configurable via DEFAULT_AI_MODEL env var)
 */

import { MultipleChoiceResponse } from '#types/ai.types'

/**
 * Create multiple choice generation prompt
 *
 * @param context - Combined text from notes and PDF extractions
 * @returns Prompt instructing GPT to generate MC questions in specific JSON format
 *
 * Output format:
 * {
 *   questions: [{
 *     question: string,
 *     answer: "Choices:\nA: ...\nB: ...\nC: ...\nD: ...\nCorrect Answer: B\nExplanation: ..."
 *   }, ...]
 * }
 */
export function createMultipleChoicePrompt(context: string): string {
  return `
Based on the following context, generate a set of 10-15 challenging multiple-choice questions.

**Instructions:**
1. Each question must have exactly four choices (A, B, C, D).
2. Each question must have only one correct answer.
3. Provide a brief but clear explanation for why the correct answer is right.
4. Format the output as a JSON object with a single key "questions", which is an array of question objects.
5. Each question object in the array should have the following structure:
   - "question": The question text.
   - "answer": A string containing the four choices, the correct answer, and the explanation, formatted exactly like this:
     "Choices:\nA: [Choice A Text]\nB: [Choice B Text]\nC: [Choice C Text]\nD: [Choice D Text]\nCorrect Answer: [A, B, C, or D]\nExplanation: [Your explanation here]"

**Context:**
---
${context}
---
`
}

export type { MultipleChoiceResponse }
