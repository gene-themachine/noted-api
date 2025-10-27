import { getOpenAIClient } from '../utils/openai.js'
import type { ExternalKnowledgeResponse } from '#types/qa.types'

/**
 * External Knowledge Service
 * Handles queries that fall outside the user's document domain
 */
export default class ExternalKnowledgeService {
  private openai = getOpenAIClient()

  /**
   * Generate answer using external knowledge sources
   */
  async generateExternalAnswer(
    query: string,
    domain_hints?: string[]
  ): Promise<ExternalKnowledgeResponse> {
    try {
      // For now, we'll use GPT-4 with instructions to be factual and cite general knowledge
      // In production, you'd integrate with web search APIs or academic databases

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.buildExternalKnowledgeSystemPrompt(domain_hints),
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      })

      const answer = response.choices[0].message.content || 'Unable to generate answer'

      return {
        answer,
        sources: ['General AI Knowledge', 'OpenAI GPT-4'],
        confidence: 0.8,
        method: 'general_ai',
      }
    } catch (error) {
      console.error('❌ External knowledge generation failed:', error)

      return {
        answer:
          'I apologize, but I cannot access external knowledge sources at the moment. Please try rephrasing your question or adding relevant documents to your note.',
        sources: [],
        confidence: 0.0,
        method: 'general_ai',
      }
    }
  }

  /**
   * Streaming variant of external knowledge generation using OpenAI streaming
   */
  async generateExternalAnswerStreaming(
    query: string,
    onChunk: (chunk: string, isComplete: boolean) => void,
    domain_hints?: string[]
  ): Promise<ExternalKnowledgeResponse> {
    let completed = false

    try {
      const system = this.buildExternalKnowledgeSystemPrompt(domain_hints)

      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: query },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        stream: true,
      })

      let answer = ''
      for await (const part of stream) {
        if (completed) break // Safety check

        const content = part.choices[0]?.delta?.content || ''
        if (content) {
          answer += content
          onChunk(content, false)
        }
      }

      // Only send completion signal once
      if (!completed) {
        completed = true
        onChunk('', true)
      }

      return {
        answer: answer || 'Unable to generate answer',
        sources: ['General AI Knowledge', 'OpenAI GPT-4'],
        confidence: answer ? 0.8 : 0.0,
        method: 'general_ai',
      }
    } catch (error) {
      console.error('❌ External knowledge streaming failed:', error)

      // Only send error if not already completed
      if (!completed) {
        completed = true
        const fallback =
          'I apologize, but I cannot access external knowledge sources at the moment. Please try rephrasing your question.'
        onChunk(fallback, true)
      }

      return {
        answer: completed
          ? 'Error occurred during streaming'
          : 'I apologize, but I cannot access external knowledge sources at the moment. Please try rephrasing your question.',
        sources: [],
        confidence: 0.0,
        method: 'general_ai',
      }
    }
  }

  /**
   * Enhanced version with web search integration
   * Placeholder for future implementation
   */
  async generateWithWebSearch(
    query: string,
    domain_hints?: string[]
  ): Promise<ExternalKnowledgeResponse> {
    // TODO: Integrate with web search APIs like:
    // - Bing Search API
    // - Google Custom Search
    // - Tavily Search API
    // - Perplexity API

    console.log('🔍 Web search not implemented yet, falling back to general AI')
    return this.generateExternalAnswer(query, domain_hints)
  }

  /**
   * Academic search integration
   * Placeholder for future implementation
   */
  async generateWithAcademicSearch(
    query: string,
    domain_hints?: string[]
  ): Promise<ExternalKnowledgeResponse> {
    // TODO: Integrate with academic APIs like:
    // - Semantic Scholar API
    // - arXiv API
    // - PubMed API
    // - CrossRef API

    console.log('🎓 Academic search not implemented yet, falling back to general AI')
    return this.generateExternalAnswer(query, domain_hints)
  }

  /**
   * Build system prompt for external knowledge generation
   */
  private buildExternalKnowledgeSystemPrompt(domain_hints?: string[]): string {
    const domainContext =
      domain_hints && domain_hints.length > 0
        ? `The user is working in domains related to: ${domain_hints.join(', ')}.`
        : ''

    return `You are a knowledgeable assistant helping with questions that require general knowledge or external information. 

${domainContext}

Guidelines:
- Provide accurate, factual information based on your training knowledge
- Be clear about the limitations of your knowledge cutoff
- If the question is very recent or requires real-time information, acknowledge this limitation
- Structure your response clearly with proper explanations
- Include relevant examples when helpful
- If the topic is complex, break it down into understandable parts
- Acknowledge uncertainty when appropriate
- Do not make up specific facts, dates, or statistics
- For academic topics, mention if recent research might have updated information

Format your response as a clear, educational answer that would be helpful for someone studying or researching the topic.`
  }

  /**
   * Determine the best external method based on query type
   */
  determineExternalMethod(
    query: string,
    _domain_hints?: string[]
  ): 'web_search' | 'general_ai' | 'academic_search' {
    const queryLower = query.toLowerCase()

    // Academic indicators
    const academicKeywords = [
      'research',
      'study',
      'paper',
      'journal',
      'scientific',
      'theory',
      'hypothesis',
    ]
    const hasAcademicKeywords = academicKeywords.some((keyword) => queryLower.includes(keyword))

    // Current events indicators
    const currentEventKeywords = ['recent', 'latest', 'current', 'today', 'now', '2024', '2025']
    const hasCurrentEventKeywords = currentEventKeywords.some((keyword) =>
      queryLower.includes(keyword)
    )

    // Factual lookup indicators
    const factualKeywords = ['what is', 'who is', 'when did', 'where is', 'how many']
    const hasFactualKeywords = factualKeywords.some((keyword) => queryLower.includes(keyword))

    if (hasAcademicKeywords) {
      return 'academic_search'
    }

    if (hasCurrentEventKeywords || hasFactualKeywords) {
      return 'web_search'
    }

    return 'general_ai'
  }
}
