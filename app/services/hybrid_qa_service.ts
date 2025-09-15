import NativeVectorService from './native_vector_service.js'
import ExternalKnowledgeService, {
  ExternalKnowledgeResponse,
} from './external_knowledge_service.js'
import { getOpenAIClient } from '../utils/openai.js'

export interface HybridQAResponse {
  answer: string
  sources: Array<{
    type: 'document' | 'external'
    content: string
    metadata?: any
  }>
  method: 'hybrid'
  confidence: number
}

/**
 * Hybrid QA Service
 * Combines document-based RAG with external knowledge
 */
export default class HybridQAService {
  private vectorService: NativeVectorService
  private externalService: ExternalKnowledgeService
  private openai = getOpenAIClient()

  constructor() {
    this.vectorService = new NativeVectorService()
    this.externalService = new ExternalKnowledgeService()
  }

  /**
   * Generate hybrid answer combining document context and external knowledge
   */
  async generateHybridAnswer(
    noteId: string,
    query: string,
    domain_hints?: string[]
  ): Promise<HybridQAResponse> {
    try {
      console.log('🔄 Starting hybrid QA generation...')

      // Step 1: Get document context (if available)
      const documentResults = await this.vectorService.searchForQA(noteId, query, 3)

      // Step 2: Get external knowledge
      const externalResult = await this.externalService.generateExternalAnswer(query, domain_hints)

      // Step 3: Combine both sources
      const hybridAnswer = await this.combineAnswers(
        query,
        documentResults,
        externalResult,
        domain_hints
      )

      return {
        answer: hybridAnswer,
        sources: [
          ...documentResults.map((result) => ({
            type: 'document' as const,
            content: result.content,
            metadata: result.metadata,
          })),
          ...externalResult.sources.map((source) => ({
            type: 'external' as const,
            content: source,
          })),
        ],
        method: 'hybrid',
        confidence: this.calculateHybridConfidence(documentResults, externalResult),
      }
    } catch (error) {
      console.error('❌ Hybrid QA generation failed:', error)

      return {
        answer: 'I encountered an error while generating your answer. Please try again.',
        sources: [],
        method: 'hybrid',
        confidence: 0.0,
      }
    }
  }

  /**
   * Combine document and external answers intelligently
   */
  private async combineAnswers(
    query: string,
    documentResults: any[],
    externalResult: ExternalKnowledgeResponse,
    domain_hints?: string[]
  ): Promise<string> {
    const hasDocuments = documentResults.length > 0
    const hasExternalAnswer = externalResult.answer && externalResult.confidence > 0.5

    // Build context sections
    let documentContext = ''
    if (hasDocuments) {
      documentContext = '\n## Document Context\n\n'
      documentResults.forEach((result, index) => {
        const citation =
          result.metadata?.title || result.metadata?.sourceFile || `Document ${index + 1}`
        documentContext += `**${citation}:**\n${result.content}\n\n`
      })
    }

    let externalContext = ''
    if (hasExternalAnswer) {
      externalContext = '\n## External Knowledge\n\n'
      externalContext += externalResult.answer
    }

    const prompt = this.buildHybridPrompt(query, documentContext, externalContext, domain_hints)

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert study assistant that combines document-based information with general knowledge to provide comprehensive answers.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    })

    return response.choices[0].message.content || 'Unable to generate hybrid answer'
  }

  /**
   * Build prompt for hybrid answer generation
   */
  private buildHybridPrompt(
    query: string,
    documentContext: string,
    externalContext: string,
    domain_hints?: string[]
  ): string {
    const domainInfo =
      domain_hints && domain_hints.length > 0
        ? `\n## Domain Context\nThe user is working with: ${domain_hints.join(', ')}\n`
        : ''

    return `You are answering a question using both the user's documents and general knowledge. Provide a comprehensive, well-structured answer that leverages both sources appropriately.

${domainInfo}${documentContext}${externalContext}

## Question
${query}

## Instructions
- Create a unified, coherent answer that draws from both document context and external knowledge
- Clearly distinguish between information from the user's documents vs. general knowledge
- Use proper citations: (Document Name) for document sources, (General Knowledge) for external info
- If document information conflicts with or adds to general knowledge, acknowledge this
- Structure your answer logically with clear sections if needed
- Be comprehensive but concise
- If either source is missing or insufficient, acknowledge this limitation
- End with a "Sources" section listing all references

## Answer`
  }

  /**
   * Calculate confidence score for hybrid response
   */
  private calculateHybridConfidence(
    documentResults: any[],
    externalResult: ExternalKnowledgeResponse
  ): number {
    const documentConfidence = documentResults.length > 0 ? 0.8 : 0.2
    const externalConfidence = externalResult.confidence || 0.5

    // Weighted average favoring document context when available
    const documentWeight = documentResults.length > 0 ? 0.7 : 0.3
    const externalWeight = 1 - documentWeight

    return documentConfidence * documentWeight + externalConfidence * externalWeight
  }

  /**
   * Stream hybrid answer generation
   */
  async generateHybridAnswerStreaming(
    noteId: string,
    query: string,
    onChunk: (chunk: string, isComplete: boolean) => void,
    domain_hints?: string[]
  ): Promise<HybridQAResponse> {
    try {
      console.log('🔄 Starting streaming hybrid QA generation...')

      // Get contexts first (non-streaming)
      const [documentResults, externalResult] = await Promise.all([
        this.vectorService.searchForQA(noteId, query, 3),
        this.externalService.generateExternalAnswer(query, domain_hints),
      ])

      // Build prompt
      let documentContext = ''
      if (documentResults.length > 0) {
        documentContext = '\n## Document Context\n\n'
        documentResults.forEach((result, index) => {
          const citation =
            result.metadata?.title || result.metadata?.sourceFile || `Document ${index + 1}`
          documentContext += `**${citation}:**\n${result.content}\n\n`
        })
      }

      let externalContext = ''
      if (externalResult.answer && externalResult.confidence > 0.5) {
        externalContext = '\n## External Knowledge\n\n'
        externalContext += externalResult.answer
      }

      const prompt = this.buildHybridPrompt(query, documentContext, externalContext, domain_hints)

      // Stream the response
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert study assistant that combines document-based information with general knowledge to provide comprehensive answers.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1200,
        stream: true,
      })

      let fullAnswer = ''
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          fullAnswer += content
          onChunk(content, false)
        }
      }

      onChunk('', true) // Signal completion

      return {
        answer: fullAnswer,
        sources: [
          ...documentResults.map((result) => ({
            type: 'document' as const,
            content: result.content,
            metadata: result.metadata,
          })),
          ...externalResult.sources.map((source) => ({
            type: 'external' as const,
            content: source,
          })),
        ],
        method: 'hybrid',
        confidence: this.calculateHybridConfidence(documentResults, externalResult),
      }
    } catch (error) {
      console.error('❌ Streaming hybrid QA generation failed:', error)

      const errorMessage = 'I encountered an error while generating your answer. Please try again.'
      onChunk(errorMessage, true)

      return {
        answer: errorMessage,
        sources: [],
        method: 'hybrid',
        confidence: 0.0,
      }
    }
  }
}
