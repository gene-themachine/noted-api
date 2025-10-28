/**
 * AI Service (Orchestrator)
 *
 * Thin orchestration layer that:
 * 1. Fetches content from notes and library items
 * 2. Delegates generation to specialized services
 * 3. Returns results
 */

import ContentFetcherService from './content_fetcher_service.js'
import { FlashcardService } from './studyTools/flashcard_service.js'
import { MultipleChoiceService } from './studyTools/multiple_choice_service.js'
import { FreeResponseService } from './studyTools/free_response_service.js'
import type {
  FlashcardGenerationData,
  MultipleChoiceGenerationData,
  FreeResponseGenerationData,
} from '#types/ai.types'

export default class AIService {
  private contentFetcher = new ContentFetcherService()
  private flashcardService = new FlashcardService()
  private multipleChoiceService = new MultipleChoiceService()
  private freeResponseService = new FreeResponseService()

  /**
   * Generate flashcard set
   */
  async generateFlashcardSet(data: FlashcardGenerationData) {
    const { flashcardSetId, userId, projectId, selectedNoteIds, selectedLibraryItemIds } = data

    // Fetch content
    const contentSources = await this.contentFetcher.fetchContent(
      selectedNoteIds,
      selectedLibraryItemIds,
      userId,
      projectId
    )

    if (contentSources.length === 0) {
      throw new Error('No content available for flashcard generation')
    }

    // Generate with specialized service
    const count = await this.flashcardService.generateFromContent(
      contentSources,
      flashcardSetId,
      userId,
      projectId
    )

    return {
      status: 'success',
      message: `Generated ${count} flashcards successfully`,
      flashcardsCount: count,
    }
  }

  /**
   * Generate multiple choice set
   */
  async generateMultipleChoiceSet(data: MultipleChoiceGenerationData) {
    const { multipleChoiceSetId, userId, projectId, selectedNoteIds, selectedLibraryItemIds } = data

    // Fetch content
    const contentSources = await this.contentFetcher.fetchContent(
      selectedNoteIds,
      selectedLibraryItemIds,
      userId,
      projectId
    )

    if (contentSources.length === 0) {
      throw new Error('No content available for multiple choice generation')
    }

    // Generate with specialized service
    const count = await this.multipleChoiceService.generateFromContent(
      contentSources,
      multipleChoiceSetId
    )

    return {
      status: 'success',
      message: `Generated ${count} questions successfully`,
      questionsCount: count,
    }
  }

  /**
   * Generate free response set
   */
  async generateFreeResponseSet(data: FreeResponseGenerationData) {
    const { freeResponseSetId, userId, projectId, selectedNoteIds, selectedLibraryItemIds } = data

    // Fetch content
    const contentSources = await this.contentFetcher.fetchContent(
      selectedNoteIds,
      selectedLibraryItemIds,
      userId,
      projectId
    )

    if (contentSources.length === 0) {
      throw new Error('No content available for free response generation')
    }

    // Generate with specialized service
    const count = await this.freeResponseService.generateFromContent(
      contentSources,
      freeResponseSetId
    )

    return {
      status: 'success',
      message: `Generated ${count} questions successfully`,
      questionsCount: count,
    }
  }
}
