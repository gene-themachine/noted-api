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
- Provide a clear, comprehensive answer based on the context provided
- When referencing specific information, include proper in-text citations using the format (Author, Year) or (DocumentName) if no author is available
- If the context contains partial information, clearly distinguish between what the sources say and any general knowledge you might add
- Use examples from the context when relevant and cite them appropriately
- If the context doesn't contain enough information, acknowledge this and explain what additional information would be helpful
- Be specific about which sources support which claims
- If multiple sources provide different information, acknowledge the differences and cite each source
- Format your response in clear, readable text with proper citations
- End your response with a "Sources" section listing all referenced materials

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
