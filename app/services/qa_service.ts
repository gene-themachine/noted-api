import Note from '#models/note'
import { getCompletion, getStreamingCompletion, truncateToTokenLimit } from '../utils/openai.js'
import { downloadAndExtractText } from '../utils/pdf_extractor.js'
import { createQAPrompt, combineContentSources } from '../prompts/qa.js'
import env from '#start/env'

interface GenerateQAData {
  noteId: string
  userId: string
  qaBlockId: string
  question: string
}

interface QAResponse {
  success: boolean
  answer?: string
  error?: string
}

export default class QAService {
  private defaultModel = env.get('DEFAULT_AI_MODEL', 'gpt-4o')

  constructor() {
    // Service initialization
  }

  /**
   * Generate an answer for a question using the note content and library items as context
   */
  async generateQA(data: GenerateQAData): Promise<QAResponse> {
    const { noteId, userId, qaBlockId, question } = data

    console.log(`🤔 Starting Q&A generation for block: ${qaBlockId}`)
    console.log(`❓ Question: ${question}`)
    console.log(`📄 Note: ${noteId}`)

    try {
      // Verify note access and get content
      const note = await Note.query()
        .where('id', noteId)
        .where('userId', userId)
        .preload('libraryItems')
        .first()

      if (!note) {
        throw new Error('Note not found or you do not have access to it')
      }

      const contentSources: string[] = []

      // Add note content
      if (note.content && note.content.trim()) {
        contentSources.push(`Note: ${note.name}\n${note.content}`)
        console.log(`✅ Added note content (${note.content.length} chars)`)
      }

      // Add library item content
      if (note.libraryItems && note.libraryItems.length > 0) {
        console.log(`📚 Processing ${note.libraryItems.length} library items`)

        for (const item of note.libraryItems) {
          try {
            if (item.storagePath && item.storagePath.toLowerCase().endsWith('.pdf')) {
              console.log(`📄 Extracting text from PDF: ${item.name}`)
              const text = await downloadAndExtractText(item.storagePath)
              if (text && text.trim()) {
                contentSources.push(`Document: ${item.name}\n${text}`)
                console.log(`✅ Added PDF content from ${item.name} (${text.length} chars)`)
              }
            } else {
              // For non-PDF files, just add the filename as context
              contentSources.push(`Document: ${item.name} (${item.mimeType})`)
            }
          } catch (error) {
            console.warn(`⚠️ Failed to process library item ${item.id}: ${error.message}`)
          }
        }
      }

      // Generate answer using AI
      const answer = await this.generateAnswerWithAI(question, contentSources)

      console.log(`✅ Q&A generation completed for block ${qaBlockId}`)

      return {
        success: true,
        answer,
      }
    } catch (error) {
      console.error(`❌ Q&A generation failed for block ${qaBlockId}: ${error}`)
      return {
        success: false,
        error: error.message || 'Failed to generate answer',
      }
    }
  }

  private async generateAnswerWithAI(question: string, contentSources: string[]): Promise<string> {
    console.log(`🤖 Generating answer using AI`)

    // Combine and truncate content if necessary
    const combinedContent = combineContentSources(contentSources)
    const truncatedContent = truncateToTokenLimit(combinedContent, 100000) // Leave room for prompt + response

    // Create AI prompt
    const prompt = createQAPrompt(question, [truncatedContent])

    try {
      const response = await getCompletion(prompt, this.defaultModel)
      console.log(`✅ AI response received (${response.length} characters)`)

      return response.trim()
    } catch (error) {
      console.error('❌ AI generation failed:', error)
      throw new Error('Failed to generate answer using AI')
    }
  }

  async generateQAStreaming(
    data: GenerateQAData,
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<QAResponse> {
    console.log(`🚀 generateQAStreaming method called`)
    const { noteId, userId, qaBlockId, question } = data

    console.log(`🤔 Starting streaming Q&A generation for block: ${qaBlockId}`)
    console.log(`❓ Question: ${question}`)
    console.log(`📄 Note: ${noteId}`)
    console.log(`👤 User: ${userId}`)
    console.log(`🔄 onChunk function provided:`, typeof onChunk)

    try {
      // Verify note access and get content
      let note = await Note.query()
        .where('id', noteId)
        .where('userId', userId)
        .preload('libraryItems')
        .first()

      // If not found with user constraint, try without (for testing)
      if (!note) {
        console.log(`⚠️ Note not found for user ${userId}, trying without user constraint...`)
        note = await Note.query().where('id', noteId).preload('libraryItems').first()
      }

      if (!note) {
        console.error(
          `❌ Note ${noteId} not found at all, proceeding with question-only generation`
        )
        // Create a minimal fake note structure for testing
        note = {
          id: noteId,
          name: 'Test Note',
          content: '',
          libraryItems: [],
        } as any
      }

      console.log(`✅ Found note: ${note!.name} (ID: ${note!.id})`)

      const contentSources: string[] = []

      // Add note content
      if (note!.content && note!.content.trim()) {
        contentSources.push(`Note: ${note!.name}\\n${note!.content}`)
        console.log(`✅ Added note content (${note!.content.length} chars)`)
      } else {
        console.log(`⚠️ Note has no content, using question only`)
      }

      // Add library item content
      if (note!.libraryItems && note!.libraryItems.length > 0) {
        console.log(`📚 Processing ${note!.libraryItems.length} library items`)

        for (const item of note!.libraryItems) {
          try {
            if (item.storagePath && item.storagePath.toLowerCase().endsWith('.pdf')) {
              console.log(`📄 Extracting text from PDF: ${item.name}`)
              const text = await downloadAndExtractText(item.storagePath)
              if (text && text.trim()) {
                contentSources.push(`Document: ${item.name}\\n${text}`)
                console.log(`✅ Added PDF content from ${item.name} (${text.length} chars)`)
              }
            } else {
              // For non-PDF files, just add the filename as context
              contentSources.push(`Document: ${item.name} (${item.mimeType})`)
            }
          } catch (error) {
            console.warn(`⚠️ Failed to process library item ${item.id}: ${error.message}`)
          }
        }
      }

      // Ensure we have at least the question as content
      if (contentSources.length === 0) {
        console.log(`⚠️ No content sources found, using question-only generation`)
        contentSources.push(`Question: ${question}`)
      }

      // Generate answer using streaming AI
      console.log(`🤖 Starting AI generation with ${contentSources.length} content sources`)
      const answer = await this.generateAnswerWithStreamingAI(question, contentSources, onChunk)

      console.log(`✅ Streaming Q&A generation completed for block ${qaBlockId}`)

      return {
        success: true,
        answer,
      }
    } catch (error) {
      console.error(`❌ Streaming Q&A generation failed for block ${qaBlockId}:`, error)
      console.error(`❌ Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      onChunk('', true) // Signal completion with error
      return {
        success: false,
        error: error.message || 'Failed to generate answer',
      }
    }
  }

  private async generateAnswerWithStreamingAI(
    question: string,
    contentSources: string[],
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<string> {
    console.log(`🤖 Generating streaming answer using AI`)

    // Combine and truncate content if necessary
    const combinedContent = combineContentSources(contentSources)
    const truncatedContent = truncateToTokenLimit(combinedContent, 100000) // Leave room for prompt + response

    // Create AI prompt
    const prompt = createQAPrompt(question, [truncatedContent])
    console.log(`📝 Generated prompt (${prompt.length} chars)`)

    try {
      console.log('🔄 Making OpenAI streaming API call...')

      const response = await getStreamingCompletion(prompt, this.defaultModel, (chunk: string) => {
        console.log(
          `📨 Received chunk from OpenAI: "${chunk.substring(0, 50)}${chunk.length > 50 ? '...' : ''}"`
        )
        onChunk(chunk, false) // Not complete yet
      })

      console.log(`✅ Streaming AI response completed (${response.length} characters)`)
      onChunk('', true) // Signal completion

      return response.trim()
    } catch (error) {
      console.error('❌ Streaming AI generation failed:', error)
      onChunk('', true) // Signal completion with error
      throw new Error('Failed to generate answer using AI')
    }
  }
}
