export function extractJsonFromResponse(response: string): any {
  try {
    // First try to parse the response directly
    return JSON.parse(response)
  } catch (error) {
    // Strip markdown code blocks if present
    let cleanedResponse = response.trim()

    // Remove markdown code block wrappers (```json ... ``` or ``` ... ```)
    const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      cleanedResponse = codeBlockMatch[1].trim()

      try {
        // Try parsing the cleaned response
        return JSON.parse(cleanedResponse)
      } catch (cleanedError) {
        console.error('❌ Failed to parse cleaned response:', cleanedError)
      }
    }

    // If that fails, try to extract JSON object or array from the response
    // Look for JSON objects {...} or arrays [...]
    const jsonMatch = cleanedResponse.match(/[\{\[][\s\S]*[\}\]]/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch (innerError) {
        console.error('❌ Failed to parse extracted JSON:', innerError)
        console.error('Raw response:', response)
        console.error('Cleaned response:', cleanedResponse)
        console.error('JSON match:', jsonMatch[0])
        return null
      }
    }
    console.error('❌ No valid JSON found in response')
    console.error('Raw response:', response)
    return null
  }
}

export function combineContentSources(sources: string[]): string {
  return sources.filter((source) => source && source.trim()).join('\n\n')
}
