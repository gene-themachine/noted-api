import OpenAI from 'openai'
import env from '#start/env'

let openaiClient: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export async function getCompletion(prompt: string, model = 'gpt-4o'): Promise<string> {
  try {
    // Making API call to OpenAI
    const client = getOpenAIClient()

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0, // For deterministic outputs
    })

    // Received OpenAI response
    return response.choices[0].message.content || ''
  } catch (error) {
    console.error('❌ Error getting completion from OpenAI:', error)
    throw error
  }
}

export async function getStreamingCompletion(
  prompt: string,
  model = 'gpt-4o',
  onChunk?: (chunk: string) => void
): Promise<{ response: string; promptTokens: number; completionTokens: number; totalTokens: number }> {
  try {
    // Starting streaming API call
    const client = getOpenAIClient()

    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      stream: true,
    })

    let fullResponse = ''
    const startTime = Date.now()

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullResponse += content
        if (onChunk) {
          onChunk(content)
        }
      }
    }

    // Calculate token usage
    const promptTokens = countTokens(prompt, model)
    const completionTokens = countTokens(fullResponse, model)
    const totalTokens = promptTokens + completionTokens
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log(`✅ Streaming completed - Response: ${fullResponse.length} chars, Tokens: ${promptTokens} prompt + ${completionTokens} completion = ${totalTokens} total (${duration}s)`)
    
    return {
      response: fullResponse,
      promptTokens,
      completionTokens,
      totalTokens
    }
  } catch (error) {
    console.error('❌ Error getting streaming completion from OpenAI:', error)
    throw error
  }
}

export function countTokens(text: string, model = 'gpt-4o'): number {
  // Use character-based estimation for token counting
  // GPT models average ~4 characters per token for English text
  // This is a reasonable approximation that avoids the tiktoken dependency
  
  // Model-specific adjustments (optional)
  let charsPerToken = 4
  if (model.includes('gpt-3.5')) {
    charsPerToken = 4.5 // GPT-3.5 is slightly less efficient
  }
  
  return Math.ceil(text.length / charsPerToken)
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const client = getOpenAIClient()
    
    // OpenAI recommends replacing newlines with spaces for embeddings
    const processedTexts = texts.map(text => text.replace(/\n/g, ' '))
    
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: processedTexts,
    })
    
    // Extract the embedding vectors
    const embeddings = response.data.map((item) => item.embedding)
    
    console.log(`✅ Generated ${embeddings.length} embeddings (dimension: ${embeddings[0]?.length || 0})`)
    return embeddings
  } catch (error) {
    console.error('❌ Error generating embeddings:', error)
    throw new Error(`Failed to generate embeddings: ${error.message}`)
  }
}

export async function getEmbedding(text: string): Promise<number[]> {
  const embeddings = await getEmbeddings([text])
  return embeddings[0]
}

export function truncateToTokenLimit(text: string, maxTokens = 120000, model = 'gpt-4o'): string {
  // Calculate approximate character limit based on token limit
  // Using the same character-to-token ratio as countTokens
  let charsPerToken = 4
  if (model.includes('gpt-3.5')) {
    charsPerToken = 4.5
  }
  
  const maxChars = maxTokens * charsPerToken
  
  if (text.length <= maxChars) {
    return text
  }
  
  const estimatedTokens = Math.ceil(text.length / charsPerToken)
  console.log(`✂️ Truncating text from ~${estimatedTokens} to ${maxTokens} tokens`)
  
  // Truncate at character level, trying to break at word boundary
  let truncated = text.substring(0, maxChars)
  
  // Try to break at last complete word
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > maxChars * 0.9) { // Only if we're not losing too much
    truncated = truncated.substring(0, lastSpace)
  }
  
  return truncated
}

