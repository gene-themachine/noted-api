# Intelligent RAG with Intent Categorization Implementation

## Overview

This implementation adds intelligent intent categorization to your existing RAG system, enabling multi-pipeline routing based on query analysis. The system can now handle queries that fall outside your document domain by routing them to appropriate knowledge sources.

## Architecture

### Core Components

1. **Intent Classification Service** (`intent_classification_service.ts`)
   - Analyzes user queries to determine appropriate pipeline
   - Uses GPT-4o-mini for intelligent classification
   - Provides fallback heuristic-based classification

2. **External Knowledge Service** (`external_knowledge_service.ts`)
   - Handles out-of-domain queries using external knowledge
   - Currently uses GPT-4 general knowledge (extensible to web search/academic APIs)
   - Supports different methods: web search, academic search, general AI

3. **Hybrid QA Service** (`hybrid_qa_service.ts`)
   - Combines document-based RAG with external knowledge
   - Intelligently merges both sources for comprehensive answers
   - Supports streaming responses

4. **Intelligent QA Service** (`intelligent_qa_service.ts`)
   - Main orchestrator that routes queries to appropriate pipelines
   - Builds domain context for classification
   - Manages the entire intelligent QA workflow

### Pipeline Flow

```
User Query → Intent Classification → Route to Pipeline → Generate Answer

Pipelines:
├── RAG Only: Document-based answers only
├── External Only: General knowledge/web search
└── Hybrid: Combined document + external knowledge
```

## Intent Classification

### Classification Categories

- **in_domain**: Query can be answered using available documents
- **out_of_domain**: Query requires external knowledge
- **hybrid**: Query benefits from both document and external knowledge

### Pipeline Routing

- **rag_only**: Use only document retrieval and context
- **external_only**: Use external knowledge sources
- **hybrid**: Combine document context with external knowledge

### Classification Logic

The system uses a two-tier approach:

1. **AI Classification**: GPT-4o-mini analyzes query with document context
2. **Fallback Heuristics**: Simple keyword-based classification if AI fails

## API Endpoints

### New Intelligent Endpoints

```typescript
// Generate intelligent answer
POST /notes/:noteId/qa/intelligent
Body: { qaBlockId: string, question: string }

// Stream intelligent answer
GET /notes/:noteId/qa/intelligent/stream
Query: ?qaBlockId=xxx&question=xxx&auth_token=xxx
```

### Response Format

```typescript
{
  success: true,
  data: {
    qaBlockId: string,
    question: string,
    answer: string,
    pipeline_used: 'rag_only' | 'external_only' | 'hybrid',
    intent_classification: {
      intent: 'in_domain' | 'out_of_domain' | 'hybrid',
      confidence: number,
      domain_topics: string[],
      suggested_pipeline: string,
      reasoning: string
    },
    confidence: number,
    sources: Array<{
      type: 'document' | 'external',
      content: string,
      metadata?: any
    }>
  }
}
```

## Usage Examples

### Example 1: Document-Specific Query (RAG Only)

```
Query: "What does my biology notes say about photosynthesis?"
→ Intent: in_domain
→ Pipeline: rag_only
→ Uses only attached documents
```

### Example 2: General Knowledge Query (External Only)

```
Query: "What is the capital of France?"
→ Intent: out_of_domain
→ Pipeline: external_only
→ Uses general AI knowledge
```

### Example 3: Hybrid Query

```
Query: "How does the photosynthesis process in my notes compare to recent research?"
→ Intent: hybrid
→ Pipeline: hybrid
→ Combines document content with external knowledge
```

## Integration with Existing System

### Backward Compatibility

- Original RAG endpoints remain unchanged
- New intelligent endpoints are additive
- Existing functionality is preserved

### Frontend Integration

Update your QA streaming hook to use the new intelligent endpoint:

```typescript
// In noted-web/src/hooks/qa.ts
const useIntelligentQA = () => {
  const startIntelligentStream = (data, onChunk, onComplete, onError) => {
    const eventSource = new EventSource(
      `/api/notes/${data.noteId}/qa/intelligent/stream?qaBlockId=${data.qaBlockId}&question=${encodeURIComponent(data.question)}&auth_token=${token}`
    )

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.isMetadata) {
        // Handle pipeline metadata
        console.log('Pipeline used:', data.pipeline_used)
        console.log('Intent classification:', data.intent_classification)
      } else {
        onChunk(data.chunk, data.isComplete)
      }
    }

    // ... error handling
  }

  return { startIntelligentStream }
}
```

## Configuration and Extensibility

### External Knowledge Sources

The system is designed to be extensible. You can easily add:

1. **Web Search APIs**:

   ```typescript
   // In external_knowledge_service.ts
   async generateWithWebSearch(query: string) {
     // Integrate Bing Search, Google Custom Search, Tavily, etc.
   }
   ```

2. **Academic Search APIs**:

   ```typescript
   async generateWithAcademicSearch(query: string) {
     // Integrate Semantic Scholar, arXiv, PubMed, etc.
   }
   ```

3. **Custom Knowledge Bases**:
   ```typescript
   async generateWithCustomKB(query: string) {
     // Connect to your organization's knowledge base
   }
   ```

### Intent Classification Tuning

Customize classification prompts and heuristics:

```typescript
// Modify buildClassificationPrompt() for domain-specific classification
// Adjust fallbackClassification() heuristics for your use case
```

## Performance Considerations

### Caching Strategy

Consider implementing caching for:

- Intent classifications for similar queries
- External knowledge responses
- Domain topic extractions

### Cost Optimization

- Intent classification uses efficient GPT-4o-mini
- External knowledge can be cached or rate-limited
- Hybrid pipeline only runs when beneficial

### Monitoring

Track these metrics:

- Intent classification accuracy
- Pipeline usage distribution
- Response quality by pipeline
- External API usage and costs

## Future Enhancements

### Planned Features

1. **Web Search Integration**: Real-time web search for current information
2. **Academic Search**: Integration with scholarly databases
3. **Domain-Specific Classification**: Custom classifiers per project domain
4. **User Feedback Loop**: Learn from user interactions to improve routing
5. **Confidence Thresholds**: Configurable confidence levels for pipeline selection

### Advanced Features

1. **Multi-Modal Support**: Handle images, charts, and other media
2. **Conversation Context**: Maintain context across multiple queries
3. **Personalization**: User-specific intent classification patterns
4. **A/B Testing**: Compare different pipeline strategies

## Deployment Notes

### Environment Variables

Add these to your environment:

```env
# External knowledge service configuration
BING_SEARCH_KEY=your_bing_api_key
TAVILY_API_KEY=your_tavily_key
SEMANTIC_SCHOLAR_API_KEY=your_semantic_scholar_key
```

### Database Changes

No database schema changes required. The system uses existing tables and adds metadata to responses.

### Monitoring and Logging

The system includes comprehensive logging:

- Intent classification decisions
- Pipeline routing choices
- Performance metrics
- Error handling

## Testing

### Test Cases

1. **Document-specific queries** with attached documents
2. **General knowledge queries** without documents
3. **Hybrid queries** requiring both sources
4. **Edge cases** with empty documents or unclear intent
5. **Error handling** for API failures

### Example Test Queries

```typescript
// Test different intent categories
const testQueries = [
  'What does this document say about X?', // in_domain
  'What is the definition of Y?', // out_of_domain
  'How does X in my notes relate to Y?', // hybrid
]
```

This implementation provides a robust foundation for intelligent query routing while maintaining backward compatibility and extensibility for future enhancements.
