import IntentClassificationService, {
  IntentClassificationResult,
  DomainContext,
} from './intent_classification_service.js'
import NativeQAService from './native_qa_service.js'
import ExternalKnowledgeService from './external_knowledge_service.js'
import HybridQAService from './hybrid_qa_service.js'
import Note from '../models/note.js'
import LibraryItem from '../models/library_item.js'

export interface IntelligentQAResponse {
  answer: string
  sources: Array<{
    type: 'document' | 'external'
    content: string
    metadata?: any
  }>
  pipeline_used: 'rag_only' | 'external_only' | 'hybrid'
  intent_classification: IntentClassificationResult
  confidence: number
}

/**
 * Intelligent QA Service
 * Main orchestrator that routes queries to appropriate pipelines based on intent
 */
export default class IntelligentQAService {
  private intentClassifier: IntentClassificationService
  private ragService: NativeQAService
  private externalService: ExternalKnowledgeService
  private hybridService: HybridQAService

  constructor() {
    this.intentClassifier = new IntentClassificationService()
    this.ragService = new NativeQAService()
    this.externalService = new ExternalKnowledgeService()
    this.hybridService = new HybridQAService()
  }

  /**
   * Main entry point for intelligent Q&A
   */
  async generateAnswer(
    noteId: string,
    userId: string,
    question: string
  ): Promise<IntelligentQAResponse> {
    try {
      console.log(`🧠 Starting intelligent Q&A for note ${noteId}`)

      // Step 1: Build domain context
      const domainContext = await this.buildDomainContext(noteId, userId)

      // Step 2: Classify intent
      const intentResult = await this.intentClassifier.classifyIntent(question, domainContext)
      console.log(`🎯 Intent classified as: ${intentResult.intent} (${intentResult.confidence})`)

      // Step 3: Route to appropriate pipeline
      let response: IntelligentQAResponse

      switch (intentResult.suggested_pipeline) {
        case 'rag_only':
          console.log('🔍 Using RAG-only pipeline - searching user documents')
          response = await this.handleRAGOnlyPipeline(noteId, userId, question, intentResult)
          break

        case 'external_only':
          console.log('🌐 Using external-only pipeline - accessing general knowledge')
          response = await this.handleExternalOnlyPipeline(question, intentResult, domainContext)
          break

        case 'hybrid':
          console.log('🔄 Using hybrid pipeline - combining documents + external knowledge')
          response = await this.handleHybridPipeline(noteId, question, intentResult, domainContext)
          break

        default:
          // Fallback to hybrid approach
          console.log('🔄 Defaulting to hybrid pipeline - combining documents + external knowledge')
          response = await this.handleHybridPipeline(noteId, question, intentResult, domainContext)
      }

      console.log(`✅ Generated answer using ${response.pipeline_used} pipeline`)
      return response
    } catch (error) {
      console.error('❌ Intelligent QA generation failed:', error)

      return {
        answer: 'I encountered an error while processing your question. Please try again.',
        sources: [],
        pipeline_used: 'rag_only',
        intent_classification: {
          intent: 'out_of_domain',
          confidence: 0,
          suggested_pipeline: 'rag_only',
          reasoning: 'Error occurred during processing',
        },
        confidence: 0.0,
      }
    }
  }

  /**
   * Streaming version of intelligent Q&A
   */
  async generateAnswerStreaming(
    noteId: string,
    userId: string,
    question: string,
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<IntelligentQAResponse> {
    try {
      console.log(`🧠 Starting streaming intelligent Q&A for note ${noteId}`)

      // Build context and classify intent (non-streaming)
      const domainContext = await this.buildDomainContext(noteId, userId)
      const intentResult = await this.intentClassifier.classifyIntent(question, domainContext)

      console.log(`🎯 Intent classified as: ${intentResult.intent} (${intentResult.confidence})`)

      // Route to appropriate streaming pipeline
      switch (intentResult.suggested_pipeline) {
        case 'rag_only':
          console.log('🔍 Using RAG-only streaming pipeline - searching user documents')
          return await this.handleRAGOnlyPipelineStreaming(
            noteId,
            userId,
            question,
            intentResult,
            onChunk
          )

        case 'external_only':
          console.log('🌐 Using external-only streaming pipeline - accessing general knowledge')
          return await this.handleExternalOnlyPipelineStreaming(
            question,
            intentResult,
            domainContext,
            onChunk
          )

        case 'hybrid':
          console.log(
            '🔄 Using hybrid streaming pipeline - combining documents + external knowledge'
          )
          return await this.handleHybridPipelineStreaming(
            noteId,
            question,
            intentResult,
            domainContext,
            onChunk
          )

        default:
          console.log(
            '🔄 Defaulting to hybrid streaming pipeline - combining documents + external knowledge'
          )
          return await this.handleHybridPipelineStreaming(
            noteId,
            question,
            intentResult,
            domainContext,
            onChunk
          )
      }
    } catch (error) {
      console.error('❌ Streaming intelligent QA generation failed:', error)

      const errorMessage =
        'I encountered an error while processing your question. Please try again.'
      onChunk(errorMessage, true)

      return {
        answer: errorMessage,
        sources: [],
        pipeline_used: 'rag_only',
        intent_classification: {
          intent: 'out_of_domain',
          confidence: 0,
          suggested_pipeline: 'rag_only',
          reasoning: 'Error occurred during processing',
        },
        confidence: 0.0,
      }
    }
  }

  /**
   * Build domain context for intent classification
   */
  private async buildDomainContext(noteId: string, userId: string): Promise<DomainContext> {
    try {
      // Get note details
      const note = await Note.query().where('id', noteId).where('userId', userId).first()

      if (!note) {
        throw new Error('Note not found or access denied')
      }

      // Get attached documents
      const attachedItems = await LibraryItem.query()
        .where('noteId', noteId)
        .whereNotNull('noteId')
        .select('name', 'mimeType')

      const attachedDocuments = attachedItems.map((item) => `${item.name} (${item.mimeType})`)

      return {
        noteId,
        attachedDocuments,
        noteContent: note.content ? 'Yes' : 'No',
        projectDomain: 'General', // Could be enhanced with project-specific domain detection
      }
    } catch (error) {
      console.error('❌ Failed to build domain context:', error)

      return {
        noteId,
        attachedDocuments: [],
        noteContent: 'Unknown',
      }
    }
  }

  /**
   * Handle RAG-only pipeline
   */
  private async handleRAGOnlyPipeline(
    noteId: string,
    userId: string,
    question: string,
    intentResult: IntentClassificationResult
  ): Promise<IntelligentQAResponse> {
    console.log('📖 RAG Pipeline: Searching through user documents...')
    const ragResponse = await this.ragService.generateQA({
      noteId,
      userId,
      qaBlockId: 'intelligent-qa-' + Date.now(),
      question,
    })
    console.log(
      `📖 RAG Pipeline: ${ragResponse.success ? 'Successfully found relevant content' : 'No relevant content found'}`
    )

    return {
      answer: ragResponse.answer || 'No answer could be generated from your documents.',
      sources: ragResponse.success
        ? [
            {
              type: 'document',
              content: 'Document-based answer',
              metadata: { pipeline: 'rag_only' },
            },
          ]
        : [],
      pipeline_used: 'rag_only',
      intent_classification: intentResult,
      confidence: ragResponse.success ? 0.8 : 0.2,
    }
  }

  /**
   * Handle external-only pipeline
   */
  private async handleExternalOnlyPipeline(
    question: string,
    intentResult: IntentClassificationResult,
    _domainContext: DomainContext
  ): Promise<IntelligentQAResponse> {
    console.log('🌍 External Pipeline: Accessing general knowledge base...')
    const externalResponse = await this.externalService.generateExternalAnswer(
      question,
      intentResult.domain_topics
    )
    console.log(
      `🌍 External Pipeline: Generated response with confidence ${externalResponse.confidence}`
    )

    return {
      answer: externalResponse.answer,
      sources: externalResponse.sources.map((source) => ({
        type: 'external' as const,
        content: source,
      })),
      pipeline_used: 'external_only',
      intent_classification: intentResult,
      confidence: externalResponse.confidence,
    }
  }

  /**
   * Handle hybrid pipeline
   */
  private async handleHybridPipeline(
    noteId: string,
    question: string,
    intentResult: IntentClassificationResult,
    _domainContext: DomainContext
  ): Promise<IntelligentQAResponse> {
    console.log('🔄 Hybrid Pipeline: Combining user documents with external knowledge...')
    const hybridResponse = await this.hybridService.generateHybridAnswer(
      noteId,
      question,
      intentResult.domain_topics
    )
    console.log(
      `🔄 Hybrid Pipeline: Generated comprehensive response with confidence ${hybridResponse.confidence}`
    )

    return {
      answer: hybridResponse.answer,
      sources: hybridResponse.sources,
      pipeline_used: 'hybrid',
      intent_classification: intentResult,
      confidence: hybridResponse.confidence,
    }
  }

  /**
   * Streaming handlers
   */
  private async handleRAGOnlyPipelineStreaming(
    noteId: string,
    userId: string,
    question: string,
    intentResult: IntentClassificationResult,
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<IntelligentQAResponse> {
    console.log('📖 RAG Streaming: Starting document search and streaming response...')
    const ragResponse = await this.ragService.generateQAStreaming(
      { noteId, userId, qaBlockId: 'intelligent-qa-streaming-' + Date.now(), question },
      onChunk
    )
    console.log(
      `📖 RAG Streaming: Completed with ${ragResponse.success ? 'success' : 'no results'}`
    )

    return {
      answer: ragResponse.answer || 'No answer could be generated from your documents.',
      sources: ragResponse.success
        ? [
            {
              type: 'document',
              content: 'Document-based answer',
              metadata: { pipeline: 'rag_only' },
            },
          ]
        : [],
      pipeline_used: 'rag_only',
      intent_classification: intentResult,
      confidence: ragResponse.success ? 0.8 : 0.2,
    }
  }

  private async handleExternalOnlyPipelineStreaming(
    question: string,
    intentResult: IntentClassificationResult,
    _domainContext: DomainContext,
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<IntelligentQAResponse> {
    console.log('🌍 External Streaming: Generating response from general knowledge...')
    const externalResponse = await this.externalService.generateExternalAnswerStreaming(
      question,
      (chunk, isComplete) => onChunk(chunk, isComplete),
      intentResult.domain_topics
    )
    console.log(`🌍 External Streaming: Completed with confidence ${externalResponse.confidence}`)

    return {
      answer: externalResponse.answer,
      sources: externalResponse.sources.map((source) => ({
        type: 'external' as const,
        content: source,
      })),
      pipeline_used: 'external_only',
      intent_classification: intentResult,
      confidence: externalResponse.confidence,
    }
  }

  private async handleHybridPipelineStreaming(
    noteId: string,
    question: string,
    intentResult: IntentClassificationResult,
    _domainContext: DomainContext,
    onChunk: (chunk: string, isComplete: boolean) => void
  ): Promise<IntelligentQAResponse> {
    console.log('🔄 Hybrid Streaming: Combining documents with external knowledge and streaming...')
    const hybridResponse = await this.hybridService.generateHybridAnswerStreaming(
      noteId,
      question,
      onChunk,
      intentResult.domain_topics
    )
    console.log(
      `🔄 Hybrid Streaming: Completed comprehensive response with confidence ${hybridResponse.confidence}`
    )

    return {
      answer: hybridResponse.answer,
      sources: hybridResponse.sources,
      pipeline_used: 'hybrid',
      intent_classification: intentResult,
      confidence: hybridResponse.confidence,
    }
  }
}
