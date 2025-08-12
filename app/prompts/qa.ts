export function createQAPrompt(question: string, contentSources: string[]): string {
  // Build context section
  let contextSection = ''
  if (contentSources.length > 0) {
    contextSection = '\n## Context\n\n'
    contextSection += 'Use the following information to answer the question:\n\n'

    contentSources.forEach((source, index) => {
      contextSection += `### Source ${index + 1}\n${source}\n\n`
    })
  }

  const prompt = `You are an intelligent study assistant helping students understand their notes and materials. Your task is to provide clear, accurate, and helpful answers to questions based on the provided context.

${contextSection}## Question
${question}

## Instructions
- Provide a clear, concise answer based on the context provided
- If the context doesn't contain enough information to fully answer the question, acknowledge this and provide what information you can
- Use examples from the context when relevant
- Keep the answer focused and avoid unnecessary elaboration
- If no context is provided, give a general but accurate answer
- Never say "The context provided does not contain enough information to answer the question" or something similar.
- Format your response in plain text without special formatting
- Make sure to provide your sources in (author last name) or something similar of the best of your ability.

## Answer`

  return prompt
}

export function extractQAResponse(response: string): string {
  // For Q&A, we just return the response as-is since it's plain text
  return response.trim()
}

export function combineContentSources(sources: string[]): string {
  return sources.filter((source) => source && source.trim()).join('\n\n')
}
