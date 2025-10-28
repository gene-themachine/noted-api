/**
 * QA Service Prompts
 *
 * Used by: QAService (app/services/qa_service.ts)
 * Purpose: Intelligent question-answering with RAG (Retrieval-Augmented Generation)
 *
 * The QA system uses a two-step pipeline:
 *
 * Step 1 - Intent Classification (GPT-4o-mini):
 *   - Analyzes the question and available document summaries
 *   - Decides: Should we search user's documents (RAG) or use general knowledge?
 *   - Examples:
 *     * "What does this PDF say about X?" → RAG (references documents)
 *     * "Summarize my notes" → RAG (asks about user's content)
 *     * "What is the capital of France?" → External (general knowledge)
 *
 * Step 2 - Answer Generation:
 *   a) RAG Pipeline (if use_documents = true):
 *      - Search Pinecone for relevant document chunks
 *      - Build context from top results
 *      - GPT-4o-mini generates answer based on context
 *   b) External Knowledge (if use_documents = false):
 *      - GPT-4o-mini answers from general knowledge
 *      - No document search needed
 *
 * Models:
 * - Classification: gpt-4o-mini (fast, cheap, sufficient for routing)
 * - RAG Answer: gpt-4o-mini (streaming response)
 * - External Answer: gpt-4o-mini (streaming response)
 *
 * All responses stream back to the user in real-time via Server-Sent Events (SSE).
 */

import type { AvailableContext } from '#types/qa.types'

/**
 * Build classification prompt for intent detection
 *
 * Asks GPT to decide if the question should be answered using documents or general knowledge.
 * Uses document summaries (generated during vectorization) to make intelligent routing decisions.
 *
 * @param question - User's question
 * @param context - Available documents with summaries and note content status
 * @returns Prompt asking for JSON response: { use_documents: boolean, reasoning: string }
 *
 * The AI considers:
 * - Does the question reference "my notes", "this document", etc.?
 * - Is the question topic related to the document summaries?
 * - Is the question general knowledge that wouldn't benefit from document search?
 */
export function buildClassificationPrompt(question: string, context: AvailableContext): string {
  let docInfo = 'No documents attached'
  if (context.documents.length > 0) {
    docInfo = context.documents
      .map((doc) => {
        const summary = doc.summary || 'Summary not yet generated'
        return `- ${doc.name}\n  Summary: ${summary}`
      })
      .join('\n')
  }

  return `Question: "${question}"

Available Documents:
${docInfo}

Note has content: ${context.hasNoteContent ? 'Yes' : 'No'}

Should this question be answered by searching the user's documents (use_documents: true),
or by using general AI knowledge (use_documents: false)?

Examples:
- "What does this document say about X?" → use_documents: true (references documents)
- "Summarize my notes" → use_documents: true (asks about user's content)
- "What is the capital of France?" → use_documents: false (general knowledge)
- "Define photosynthesis" when docs are about biology → use_documents: true (relevant to docs)
- "Define photosynthesis" when docs are about history → use_documents: false (not relevant)

Respond with JSON: {"use_documents": true/false, "reasoning": "brief explanation"}`
}

/**
 * Build RAG prompt for document-based answers
 *
 * Provides document chunks retrieved from Pinecone vector search.
 * Instructs GPT to answer based ONLY on the provided context.
 *
 * @param question - User's question
 * @param context - Retrieved document chunks from Pinecone (top 5 most relevant)
 * @returns Prompt asking GPT to answer based on context only
 *
 * The prompt emphasizes:
 * - Answer based on documents only (no hallucination)
 * - Keep it brief (2-3 sentences)
 * - No citation numbers (just natural writing)
 *
 * Context comes from NativeVectorService.searchForQA() which retrieves
 * the most relevant chunks based on embedding similarity.
 */
export function buildRAGPrompt(question: string, context: string): string {
  return `Answer this question using only the provided documents. Be brief and direct (2-3 sentences max). Do NOT include citation numbers in your answer - just write naturally.

DOCUMENTS:
${context}

QUESTION: ${question}

ANSWER:`
}

/**
 * System prompt for classification
 *
 * Used in the first step of QA to route questions.
 * Instructs GPT to respond with JSON only (no extra text).
 */
export const CLASSIFICATION_SYSTEM_PROMPT =
  'You classify questions for a Q&A system. Respond with JSON only: {"use_documents": true/false, "reasoning": "why"}'

/**
 * System prompt for external knowledge answers
 *
 * Used when questions don't require document search (general knowledge).
 * Keeps answers brief since these are quick reference questions.
 */
export const EXTERNAL_KNOWLEDGE_SYSTEM_PROMPT =
  'You are a helpful assistant. Provide brief, concise answers (2-4 sentences maximum).'
