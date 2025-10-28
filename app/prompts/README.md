# Prompts Directory

This directory contains all GPT prompts used throughout the Noted application. Prompts are organized by feature and extracted from service files for better maintainability.

## Purpose

Separating prompts from service logic provides:
- **Clarity**: Easy to see what we're asking GPT to do
- **Maintainability**: Update prompts without touching service logic
- **Testing**: Can test prompt generation independently
- **Iteration**: Quick experimentation with prompt variations

## File Organization

### Study Tool Generation

**[flashcard.ts](./flashcard.ts)** - Flashcard generation
- `createFlashcardPrompt()` - Generate 8-12 term/definition flashcards
- Used by: `FlashcardService`
- Model: `gpt-4o`
- Output: JSON with flashcard array

**[multiple_choice.ts](./multiple_choice.ts)** - Multiple choice question generation
- `createMultipleChoicePrompt()` - Generate 10-15 MC questions with explanations
- Used by: `MultipleChoiceService`
- Model: `gpt-4o`
- Output: JSON with questions array (4 choices each)

**[free_response.ts](./free_response.ts)** - Free response generation & evaluation
- `createFreeResponsePrompt()` - Generate 5-10 questions with 4-point rubrics
- `createFreeResponseEvaluationPrompt()` - Grade student answers against rubrics
- Used by: `FreeResponseService`
- Models: `gpt-4o` (generation), `gpt-4o-mini` (evaluation)
- Output: JSON with questions/rubrics or evaluation scores/feedback

### Question Answering (RAG)

**[qa_service_prompts.ts](./qa_service_prompts.ts)** - RAG system prompts (ACTIVE)
- `buildClassificationPrompt()` - Intent classification (use docs vs. general knowledge)
- `buildRAGPrompt()` - Answer from document context (Pinecone search results)
- System prompts for classification and external knowledge
- Used by: `QAService`
- Models: `gpt-4o-mini` (all QA operations)
- Output: Streaming text responses via SSE

### Shared Utilities

**[shared.ts](./shared.ts)** - Common parsing utilities
- `extractJsonFromResponse()` - Parse JSON from GPT (handles markdown wrapping)
- `combineContentSources()` - Merge multiple content sources into one string
- Used by: All study tool services
- Purpose: Handle messy GPT responses gracefully

## Prompt Engineering Patterns

### 1. JSON Output Format

Most generation prompts request JSON responses with strict schemas:

```typescript
// Example from flashcard.ts
{
  "flashcards": [
    {
      "term": "Clear, concise term or question",
      "definition": "Comprehensive, educational answer or definition"
    }
  ]
}
```

**Why?** Structured output is easier to parse and validate. We use `extractJsonFromResponse()` to handle various response formats.

### 2. Detailed Instructions

Prompts include:
- Clear task description
- Specific constraints (e.g., "8-12 flashcards", "2-4 sentences")
- Output format with examples
- Quality guidelines (e.g., "focus on key concepts")

**Why?** More detailed prompts yield more consistent, higher-quality results.

### 3. Educational Focus

Study tool prompts emphasize:
- Pedagogical best practices (varied question types, clear explanations)
- Appropriate difficulty levels (mix of recall and higher-order thinking)
- Content-specific rubrics (not generic grading criteria)

**Why?** The app is for studying, so prompts are optimized for learning outcomes.

### 4. Streaming Responses

QA prompts are designed for streaming:
- Brief answers (2-3 sentences for RAG, 2-4 for external)
- Natural language (no complex formatting that breaks streaming)
- Direct responses (no preamble like "Here's the answer:")

**Why?** Streaming provides better UX - users see responses in real-time.

## Data Flow

### Study Material Generation

```
User selects notes/PDFs
  ↓
ContentFetcherService combines content
  ↓
Prompt function (flashcard/MC/FR) builds GPT prompt
  ↓
GPT-4o generates structured JSON
  ↓
extractJsonFromResponse() parses response
  ↓
Service saves to database
```

### Question Answering (RAG)

```
User asks question in note
  ↓
QAService gets available context (doc summaries)
  ↓
buildClassificationPrompt() → GPT-4o-mini decides route
  ↓
IF use_documents:
  NativeVectorService searches Pinecone → top 5 chunks
  buildRAGPrompt() → GPT-4o-mini streams answer
ELSE:
  External knowledge prompt → GPT-4o-mini streams answer
  ↓
Response streams to user via SSE
```

### Free Response Evaluation

```
Student submits answer
  ↓
createFreeResponseEvaluationPrompt() includes:
  - Question
  - Model answer
  - Student answer
  - Rubric (4 criteria)
  ↓
GPT-4o-mini evaluates against rubric
  ↓
Returns scored criteria + feedback
  ↓
Saved to evaluation history
```

## Model Selection Strategy

**GPT-4o** (Slower, expensive, highest quality)
- Flashcard generation
- Multiple choice generation
- Free response generation
- Use when: Quality of generated content is critical

**GPT-4o-mini** (Faster, cheaper, good quality)
- Free response evaluation (grading is simpler than generation)
- QA intent classification (routing decision)
- RAG answer generation (brief answers from provided context)
- External knowledge answers (general knowledge queries)
- Use when: Task is simpler or speed/cost matters

**Text-embedding-3-small** (Vector embeddings)
- Document vectorization (NativeVectorService)
- Query embeddings for Pinecone search
- Not used in this directory (handled in utils/openai.ts)

## Adding New Prompts

When adding new AI features:

1. **Create new file** in this directory (e.g., `summary.ts`)
2. **Add file-level documentation**:
   ```typescript
   /**
    * Summary Generation Prompts
    *
    * Used by: SummaryService
    * Purpose: Generate concise summaries of notes
    * Model: gpt-4o-mini
    */
   ```
3. **Document each function**:
   ```typescript
   /**
    * Create summary generation prompt
    *
    * @param content - Note content to summarize
    * @param maxLength - Maximum summary length in sentences
    * @returns Prompt asking for concise summary
    */
   export function createSummaryPrompt(content: string, maxLength: number): string {
     // ...
   }
   ```
4. **Update this README** with the new file
5. **Consider reusing** `shared.ts` utilities for parsing

## Prompt Maintenance

### Testing Prompts

When changing prompts, test with:
- **Short content** (1-2 paragraphs) - does it still work?
- **Long content** (near token limit) - does it handle truncation?
- **Edge cases** (empty content, special characters, code blocks)
- **Response parsing** - does `extractJsonFromResponse()` still work?

### Monitoring Quality

Watch for:
- **Consistency** - Are responses following the format?
- **Quality** - Are flashcards/questions pedagogically sound?
- **Errors** - Are JSON parsing errors increasing?
- **Edge cases** - Are there new failure modes?

### Version Control

When making significant prompt changes:
- Document why (e.g., "Increased flashcard count from 8-12 to 10-15")
- Test thoroughly before deploying
- Monitor logs for parsing errors after deployment
- Keep old version commented for easy rollback if needed

## Related Files

- **Services**: `/app/services/studyTools/` - Uses these prompts
- **Types**: `/types/ai.types.ts` - Type definitions for responses
- **Utils**: `/app/utils/openai.ts` - GPT client and token utilities
- **Models**: `/app/models/` - Database models for storing results

## Environment Variables

Prompts reference these models via env vars:
- `DEFAULT_AI_MODEL` - Primary model (default: `gpt-4o`)
- `OPENAI_API_KEY` - API authentication

Model selection is in the service files, not the prompts themselves.
