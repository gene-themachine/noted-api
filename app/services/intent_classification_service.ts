import { getOpenAIClient } from '../utils/openai.js'
import type { IntentClassificationResult, DomainContext } from '#types/qa.types'

/**
 * Intent Classification Service
 * Determines whether a query should use RAG, external knowledge, or both
 */
export default class IntentClassificationService {
  private openai = getOpenAIClient()

  /**
   * Classify user intent and determine appropriate pipeline
   */
  async classifyIntent(
    query: string,
    domainContext: DomainContext
  ): Promise<IntentClassificationResult> {
    try {
      const prompt = this.buildClassificationPrompt(query, domainContext)

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an intent classifier for a RAG system. Analyze queries and determine the best pipeline approach.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      })

      const result = JSON.parse(response.choices[0].message.content || '{}')

      const hasDocs =
        (domainContext.attachedDocuments && domainContext.attachedDocuments.length > 0) ||
        domainContext.noteContent === 'Yes'

      const intent: 'in_domain' | 'out_of_domain' | 'hybrid' =
        result.intent || (hasDocs ? 'in_domain' : 'out_of_domain')

      // Be conservative: default to rag_only when user has context, else external_only
      let suggested: 'rag_only' | 'external_only' | 'hybrid' =
        result.suggested_pipeline || (hasDocs ? 'rag_only' : 'external_only')

      // Sanity-correct suggested pipeline
      if (hasDocs && suggested === 'external_only' && intent !== 'out_of_domain') {
        suggested = 'rag_only'
      }
      if (!hasDocs && suggested === 'rag_only') {
        suggested = 'external_only'
      }

      const confidence =
        typeof result.confidence === 'number'
          ? result.confidence
          : Number.parseFloat(result.confidence || '0.5') || 0.5

      return {
        intent,
        confidence,
        domain_topics: result.domain_topics || [],
        suggested_pipeline: suggested,
        reasoning: result.reasoning || 'Classification completed',
      }
    } catch (error) {
      console.error('❌ Intent classification failed:', error)

      // Fallback to simple heuristics
      return this.fallbackClassification(query, domainContext)
    }
  }

  /**
   * Build classification prompt with context
   */
  private buildClassificationPrompt(query: string, context: DomainContext): string {
    const documentSummary =
      context.attachedDocuments.length > 0
        ? `User has ${context.attachedDocuments.length} documents attached: ${context.attachedDocuments.join(', ')}`
        : 'User has no documents attached to this note'

    return `
Analyze this user query and classify the intent for a RAG (Retrieval-Augmented Generation) system.

## User Query
"${query}"

## Available Context
- ${documentSummary}
- Project Domain: ${context.projectDomain || 'General'}
- Note has content: ${context.noteContent ? 'Yes' : 'No'}

## Classification Task
Determine the best pipeline approach and respond with valid JSON:

{
  "intent": "in_domain" | "out_of_domain" | "hybrid",
  "confidence": 0.0-1.0,
  "domain_topics": ["topic1", "topic2"],
  "suggested_pipeline": "rag_only" | "external_only" | "hybrid",
  "reasoning": "explanation of classification decision"
}

## Intent Definitions
- **in_domain**: Query can be answered using available documents/notes
- **out_of_domain**: Query requires external knowledge not in documents
- **hybrid**: Query benefits from both document context AND external knowledge

## Pipeline Definitions
- **rag_only**: Use only document retrieval and context
- **external_only**: Use external knowledge sources (web search, general AI)
- **hybrid**: Combine document context with external knowledge

## Examples
- "What does this document say about photosynthesis?" → in_domain, rag_only
- "What is the capital of France?" → out_of_domain, external_only
- "How does the photosynthesis process in my biology notes compare to recent research?" → hybrid, hybrid

Analyze the query and respond with appropriate classification.
`
  }

  /**
   * Fallback classification using simple heuristics
   */
  private fallbackClassification(
    query: string,
    context: DomainContext
  ): IntentClassificationResult {
    const queryLower = query.toLowerCase()

    // Check for document-specific keywords
    const documentKeywords = ['document', 'note', 'file', 'pdf', 'this says', 'according to']
    const hasDocumentKeywords = documentKeywords.some((keyword) => queryLower.includes(keyword))

    // Check for general knowledge keywords
    const generalKeywords = ['what is', 'define', 'explain', 'how does', 'why do']
    const hasGeneralKeywords = generalKeywords.some((keyword) => queryLower.includes(keyword))

    // Simple classification logic
    if (hasDocumentKeywords && context.attachedDocuments.length > 0) {
      return {
        intent: 'in_domain',
        confidence: 0.7,
        suggested_pipeline: 'rag_only',
        reasoning: 'Query contains document-specific keywords and documents are available',
      }
    }

    if (hasGeneralKeywords && context.attachedDocuments.length === 0) {
      return {
        intent: 'out_of_domain',
        confidence: 0.6,
        suggested_pipeline: 'external_only',
        reasoning: 'Query asks for general knowledge and no documents are available',
      }
    }

    // Default: prefer grounding if any doc is available
    if (context.attachedDocuments.length > 0 || context.noteContent === 'Yes') {
      return {
        intent: 'in_domain',
        confidence: 0.5,
        suggested_pipeline: 'rag_only',
        reasoning: 'Defaulted to document-grounded answer when context exists',
      }
    }

    // Otherwise, prefer external answer
    return {
      intent: 'out_of_domain',
      confidence: 0.5,
      suggested_pipeline: 'external_only',
      reasoning: 'No context available; defaulting to external knowledge',
    }
  }

  /**
   * Extract domain topics from available documents
   */
  async extractDomainTopics(documentContents: string[]): Promise<string[]> {
    if (documentContents.length === 0) return []

    try {
      const combinedContent = documentContents.join('\n\n').slice(0, 4000) // Limit content size

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Extract the main academic/professional topics and domains from the provided text. Return as a JSON array of topic strings.',
          },
          {
            role: 'user',
            content: `Extract main topics from this content:\n\n${combinedContent}`,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      })

      const result = JSON.parse(response.choices[0].message.content || '{"topics": []}')
      return result.topics || []
    } catch (error) {
      console.error('❌ Topic extraction failed:', error)
      return []
    }
  }
}
