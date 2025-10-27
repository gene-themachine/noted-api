import { MultipleChoiceResponse } from '#types/ai.types'

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
