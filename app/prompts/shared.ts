/**
 * Shared Prompt Utilities
 *
 * Used by: All study tool services (FlashcardService, MultipleChoiceService, FreeResponseService)
 * Purpose: Common utilities for parsing GPT responses and combining content
 *
 * These utilities handle the messy reality of GPT responses:
 * - Sometimes JSON is wrapped in markdown code blocks
 * - Sometimes there's extra text before/after the JSON
 * - Sometimes the response is malformed
 *
 * These functions gracefully extract JSON even from messy responses.
 */

/**
 * Extract JSON from GPT response (handles markdown code blocks and extra text)
 *
 * GPT often returns JSON wrapped in markdown code blocks like:
 * ```json
 * { "key": "value" }
 * ```
 *
 * This function handles various response formats:
 * 1. Direct JSON: { "key": "value" }
 * 2. Markdown wrapped: ```json { "key": "value" } ```
 * 3. Embedded in text: "Here's the data: { "key": "value" }"
 *
 * @param response - Raw response from GPT
 * @returns Parsed JSON object, or null if parsing fails
 *
 * Used by all study tool generation services to parse GPT responses.
 */
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

/**
 * Combine multiple content sources into a single string
 *
 * @param sources - Array of content strings (from notes, PDFs, etc.)
 * @returns Combined string with sources separated by blank lines
 *
 * Filters out empty/whitespace-only sources to keep prompts clean.
 * Used by ContentFetcherService and study tool services.
 */
export function combineContentSources(sources: string[]): string {
  return sources.filter((source) => source && source.trim()).join('\n\n')
}
