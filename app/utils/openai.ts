import OpenAI from 'openai'
import { encoding_for_model } from 'tiktoken'
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
    console.log(`🔄 Making API call to OpenAI (${model})`)
    const client = getOpenAIClient()

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0, // For deterministic outputs
    })

    console.log('✅ Received response from OpenAI')
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
): Promise<string> {
  try {
    console.log(`🔄 Making streaming API call to OpenAI (${model})`)
    const client = getOpenAIClient()

    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      stream: true,
    })

    let fullResponse = ''

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        console.log(
          `🔥 OpenAI chunk received: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}" (${content.length} chars)`
        )
        fullResponse += content
        if (onChunk) {
          onChunk(content)
        }
      }
    }

    console.log('✅ Received streaming response from OpenAI')
    return fullResponse
  } catch (error) {
    console.error('❌ Error getting streaming completion from OpenAI:', error)
    throw error
  }
}

export function countTokens(text: string, model = 'gpt-4o'): number {
  try {
    const encoding = encoding_for_model(model as any)
    const tokens = encoding.encode(text)
    encoding.free()
    return tokens.length
  } catch (error) {
    console.warn('⚠️ Could not count tokens, using character-based estimate:', error)
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }
}

export function truncateToTokenLimit(text: string, maxTokens = 120000, model = 'gpt-4o'): string {
  const encoding = encoding_for_model(model as any)
  const tokens = encoding.encode(text)

  if (tokens.length <= maxTokens) {
    encoding.free()
    return text
  }

  console.log(`✂️ Truncating text from ${tokens.length} to ${maxTokens} tokens`)

  // Truncate tokens and decode back to text
  const truncatedTokens = tokens.slice(0, maxTokens)
  const result = new TextDecoder().decode(encoding.decode(truncatedTokens))

  encoding.free()
  return result
}
