/**
 * QA Service
 *
 * Handles question-answering with intelligent routing:
 * 1. User asks a question
 * 2. We classify the intent (should we search documents or use general knowledge?)
 * 3. Route to appropriate pipeline:
 *    - RAG: Search user's documents and answer based on them
 *    - External: Answer using general AI knowledge
 */

import NativeVectorService from './native_vector_service.js'
import { getOpenAIClient, getStreamingCompletion } from '../utils/openai.js'
import LibraryItem from '#models/library_item'
import Note from '#models/note'
import type { QAResponse, AvailableContext } from '#types/qa.types'
import {
  buildClassificationPrompt,
  buildRAGPrompt,
  CLASSIFICATION_SYSTEM_PROMPT,
  EXTERNAL_KNOWLEDGE_SYSTEM_PROMPT,
} from '#prompts/qa_service_prompts'

export default class QAService {
  private vectorService = new NativeVectorService()
  private openai = getOpenAIClient()

  /**
   * Main entry point: Answer a user's question
   *
   * @param noteId - The note they're asking about
   * @param userId - User ID (for authorization)
   * @param question - The question text
   * @param onChunk - Callback for streaming response chunks
   */
  async answerQuestion(
    noteId: string,
    userId: string,
    question: string,
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<QAResponse> {
    console.log(`Question: "${question}"`)

    // Step 1: Get context about what documents/notes are available
    const context = await this.getAvailableContext(noteId, userId)

    // Step 2: Use GPT to classify: should we search docs or use general knowledge?
    const shouldSearchDocs = await this.classifyIntent(question, context)

    // Step 3: Route to appropriate pipeline
    if (shouldSearchDocs) {
      console.log('Searching user documents...')
      return this.searchDocumentsAndAnswer(noteId, userId, question, onChunk)
    } else {
      console.log('Using general knowledge...')
      return this.answerFromGeneralKnowledge(question, onChunk)
    }
  }

  /**
   * Step 1: Get context about available documents and notes
   *
   * Returns information about what documents are attached to this note,
   * including their summaries (generated during vectorization).
   */
  private async getAvailableContext(noteId: string, userId: string): Promise<AvailableContext> {
    // Get note
    const note = await Note.query().where('id', noteId).where('userId', userId).first()

    // Get attached documents with their summaries
    const attachedDocs = await LibraryItem.query()
      .where('noteId', noteId)
      .select('name', 'mimeType', 'summary')

    return {
      documents: attachedDocs.map((doc) => ({
        name: `${doc.name} (${doc.mimeType})`,
        summary: doc.summary,
      })),
      hasNoteContent: !!note?.content,
    }
  }

  /**
   * Step 2: Classify intent using GPT-4o-mini
   *
   * Ask GPT: "Based on the question and available documents, should we search
   * the user's documents or answer from general knowledge?"
   *
   * Returns: true = search documents, false = use general knowledge
   */
  private async classifyIntent(question: string, context: AvailableContext): Promise<boolean> {
    // If no documents available, must use external knowledge
    if (context.documents.length === 0 && !context.hasNoteContent) {
      console.log('ℹ️ No documents available, using external knowledge')
      return false
    }

    // Build a simple prompt for GPT to classify
    const prompt = buildClassificationPrompt(question, context)

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: CLASSIFICATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      })

      const result = JSON.parse(response.choices[0].message.content || '{}')
      console.log(
        `🎯 Classification: ${result.use_documents ? 'RAG' : 'External'} - ${result.reasoning}`
      )

      return result.use_documents || false
    } catch (error) {
      console.error('❌ Classification failed:', error)
      // Fallback: if docs exist, search them
      return context.documents.length > 0
    }
  }

  /**
   * Step 3a: RAG Pipeline - Search documents and answer
   *
   * Uses vector search to find relevant chunks from the user's documents,
   * then generates an answer based on those chunks.
   */
  private async searchDocumentsAndAnswer(
    noteId: string,
    userId: string,
    question: string,
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<QAResponse> {
    try {
      // Verify user has access to this note
      const note = await Note.query().where('id', noteId).where('userId', userId).first()
      if (!note) {
        onChunk('', true)
        return {
          answer: 'Note not found or access denied',
          success: false,
          pipeline_used: 'rag',
          confidence: 0,
        }
      }

      // Search for relevant document chunks using vector similarity
      const searchResults = await this.vectorService.searchForQA(noteId, question, 3)
      if (searchResults.length === 0) {
        const fallback =
          "I couldn't find relevant information in the documents attached to this note."
        onChunk(fallback, true)
        return {
          answer: fallback,
          success: true,
          pipeline_used: 'rag',
          confidence: 0.5,
        }
      }

      // Build context from search results
      const context = searchResults.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n')

      // Build prompt
      const prompt = buildRAGPrompt(question, context)

      // Stream the answer
      await getStreamingCompletion(prompt, 'gpt-4o', (chunk: string) => {
        onChunk(chunk, false)
      })

      // Add source citations
      const sources = this.formatSources(searchResults)
      if (sources) {
        onChunk(`\n\n${sources}`, false)
      }

      // Signal completion
      onChunk('', true)

      return {
        answer: 'Answer generated successfully',
        success: true,
        pipeline_used: 'rag',
        confidence: 0.8,
      }
    } catch (error) {
      console.error('❌ RAG pipeline failed:', error)
      onChunk('', true)
      return {
        answer: 'Failed to generate answer from documents',
        success: false,
        pipeline_used: 'rag',
        confidence: 0,
      }
    }
  }

  /**
   * Format source citations from search results
   */
  private formatSources(searchResults: any[]): string {
    const sources = searchResults
      .filter((r) => r.sourceType === 'library_item' && (r.author || r.sourceFile))
      .map((r) => {
        if (r.author && r.title) {
          return `- ${r.author}. "${r.title}". From: ${r.sourceFile}`
        }
        return `- Source: ${r.sourceFile}`
      })
      .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates

    return sources.length > 0 ? `**Sources:**\n${sources.join('\n')}` : ''
  }

  /**
   * Step 3b: External Pipeline - Answer from general knowledge
   *
   * Uses GPT-4o directly to answer the question using general AI knowledge.
   * Configured to give brief, concise answers.
   */
  private async answerFromGeneralKnowledge(
    question: string,
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<QAResponse> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: EXTERNAL_KNOWLEDGE_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
        stream: true,
      })

      let answer = ''
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          answer += content
          onChunk(content, false)
        }
      }

      onChunk('', true)

      return {
        answer: answer || 'Unable to generate answer',
        success: !!answer,
        pipeline_used: 'external',
        confidence: 0.8,
      }
    } catch (error) {
      console.error('❌ External knowledge generation failed:', error)

      const fallback =
        'I apologize, but I cannot answer that question at the moment. Please try rephrasing.'
      onChunk(fallback, true)

      return {
        answer: fallback,
        success: false,
        pipeline_used: 'external',
        confidence: 0.0,
      }
    }
  }
}
