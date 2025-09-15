import NativeVectorService from './native_vector_service.js'
import Note from '#models/note'
import { getCompletion, getStreamingCompletion } from '../utils/openai.js'

interface QAData {
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

/**
 * Native QA service using direct SDK calls without LangChain
 */
export default class NativeQAService {
  private vectorService: NativeVectorService

  constructor() {
    this.vectorService = new NativeVectorService()
  }

  /**
   * Generate QA answer (non-streaming)
   */
  async generateQA(data: QAData): Promise<QAResponse> {
    try {
      const { noteId, userId, question } = data

      // Verify note access
      const note = await Note.query().where('id', noteId).where('userId', userId).first()

      if (!note) {
        return {
          success: false,
          error: 'Note not found or access denied',
        }
      }

      // Search for relevant documents
      const searchResults = await this.vectorService.searchForQA(noteId, question, 3)

      // Generate answer
      const answer = await this.generateAnswer(question, searchResults)

      return {
        success: true,
        answer,
      }
    } catch (error) {
      console.error(`❌ QA generation failed: ${error.message}`)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Generate QA answer (streaming)
   */
  async generateQAStreaming(
    data: QAData,
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<QAResponse> {
    try {
      const { noteId, userId, question } = data

      // Verify note access
      const note = await Note.query().where('id', noteId).where('userId', userId).first()

      if (!note) {
        onChunk('', true)
        return {
          success: false,
          error: 'Note not found or access denied',
        }
      }

      // Search for relevant documents
      const searchResults = await this.vectorService.searchForQA(noteId, question, 3)

      // Generate streaming answer
      const answer = await this.generateStreamingAnswer(question, searchResults, onChunk)

      return {
        success: true,
        answer,
      }
    } catch (error) {
      console.error(`❌ Streaming QA failed: ${error.message}`)
      onChunk('', true)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Generate answer from search results with citations
   */
  private async generateAnswer(question: string, searchResults: any[]): Promise<string> {
    if (searchResults.length === 0) {
      return "I couldn't find relevant information in the documents attached to this note to answer your question."
    }

    // Build context with citations
    const contextParts = searchResults.map((result, i) => {
      const citation = this.formatCitation(result)
      return `[${i + 1}] ${result.content}${citation ? ` ${citation}` : ''}`
    })
    const context = contextParts.join('\n\n')

    // Generate citations list
    const citations = this.generateCitations(searchResults)

    const prompt = `Answer this question using only the provided documents. Be brief and direct (2-3 sentences max). Include inline citations where appropriate.

DOCUMENTS:
${context}

QUESTION: ${question}

ANSWER:`

    const answer = await getCompletion(prompt)

    // Add citations if any were found
    if (citations) {
      return `${answer}\n\n${citations}`
    }

    return answer
  }

  /**
   * Generate streaming answer from search results with citations
   */
  private async generateStreamingAnswer(
    question: string,
    searchResults: any[],
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<string> {
    if (searchResults.length === 0) {
      const fallback =
        "I couldn't find relevant information in the documents attached to this note."
      onChunk(fallback, true)
      return fallback
    }

    // Build context with citations
    const contextParts = searchResults.map((result, i) => {
      const citation = this.formatCitation(result)
      return `[${i + 1}] ${result.content}${citation ? ` ${citation}` : ''}`
    })
    const context = contextParts.join('\n\n')

    // Generate citations list
    const citations = this.generateCitations(searchResults)

    const prompt = `Answer this question using only the provided documents. Be brief and direct (2-3 sentences max). Include inline citations where appropriate.

DOCUMENTS:
${context}

QUESTION: ${question}

ANSWER:`

    const result = await getStreamingCompletion(prompt, 'gpt-4o', (chunk: string) => {
      onChunk(chunk, false)
    })

    // Send citations after the main answer
    if (citations) {
      onChunk(`\n\n${citations}`, false)
    }

    onChunk('', true)

    const fullAnswer = citations
      ? `${result.response.trim()}\n\n${citations}`
      : result.response.trim()
    return fullAnswer
  }

  /**
   * Format a citation for a search result
   */
  private formatCitation(result: any): string {
    if (result.sourceType === 'library_item' && result.author) {
      // Extract year from content if possible
      const yearMatch = result.content.match(/\b(19|20)\d{2}\b/)
      const year = yearMatch ? yearMatch[0] : new Date().getFullYear()
      return `(${result.author}, ${year})`
    }
    return ''
  }

  /**
   * Generate citations list for search results
   */
  private generateCitations(searchResults: any[]): string {
    const citations = searchResults
      .filter((r) => r.sourceType === 'library_item' && (r.author || r.sourceFile))
      .map((r) => {
        if (r.author && r.title) {
          return `- ${r.author}. "${r.title}". From: ${r.sourceFile}`
        } else if (r.sourceFile) {
          return `- Source: ${r.sourceFile}`
        }
        return null
      })
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates

    if (citations.length > 0) {
      return `**Sources:**\n${citations.join('\n')}`
    }

    return ''
  }
}
