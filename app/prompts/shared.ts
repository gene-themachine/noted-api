export function extractJsonFromResponse(response: string): any {
  try {
    // First try to parse the response directly
    return JSON.parse(response)
  } catch (error) {
    // If that fails, try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch (innerError) {
        console.error('❌ Failed to parse extracted JSON:', innerError)
        console.error('Raw response:', response)
        return null
      }
    }
    console.error('❌ No JSON found in response')
    return null
  }
}

export function combineContentSources(sources: string[]): string {
  return sources.filter((source) => source && source.trim()).join('\n\n')
}
