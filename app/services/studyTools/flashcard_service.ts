import { v4 as uuidv4 } from 'uuid'
import { DateTime } from 'luxon'
import Database from '@adonisjs/lucid/services/db'
import FlashcardSet from '#models/flashcard_set'
import Flashcard from '#models/flashcard'
import Note from '#models/note'
import env from '#start/env'
import { getCompletion, truncateToTokenLimit } from '../../utils/openai.js'
import { createFlashcardPrompt } from '../../prompts/flashcard.js'
import { extractJsonFromResponse, combineContentSources } from '../../prompts/shared.js'

export class FlashcardService {
  private model = env.get('DEFAULT_AI_MODEL', 'gpt-4o')

  /**
   * Get project flashcard sets for a user
   * Authorization: Database filters by userId ensure user can only access their own data
   */
  async getProjectFlashcardSets(userId: string, projectId: string) {
    const flashcardSets = await FlashcardSet.query()
      .where('project_id', projectId)
      .where('user_id', userId)
      .preload('notes')
      .preload('libraryItems')
      .preload('flashcards')
      .orderBy('created_at', 'desc')

    return flashcardSets
  }

  /**
   * Get a specific flashcard set
   */
  async getFlashcardSet(userId: string, setId: string) {
    const flashcardSet = await FlashcardSet.query()
      .where('id', setId)
      .where('user_id', userId)
      .preload('notes')
      .preload('libraryItems')
      .preload('flashcards')
      .first()

    if (!flashcardSet) {
      throw new Error('Flashcard set not found or access denied')
    }

    return flashcardSet
  }

  /**
   * Update a flashcard set
   */
  async updateFlashcardSet(userId: string, setId: string, payload: { name: string }) {
    const flashcardSet = await this.getFlashcardSet(userId, setId)

    // Update the set name
    flashcardSet.name = payload.name
    await flashcardSet.save()

    return flashcardSet
  }

  /**
   * Delete a flashcard set and all its flashcards
   */
  async deleteFlashcardSet(userId: string, setId: string) {
    const flashcardSet = await this.getFlashcardSet(userId, setId)

    // Delete the set (flashcards will be deleted via CASCADE)
    await flashcardSet.delete()
  }

  /**
   * Mark all flashcards associated with a note as needing update
   */
  async markFlashcardsAsNeedingUpdate(userId: string, noteId: string) {
    // First verify the user has access to the note
    const note = await Note.query().where('id', noteId).where('user_id', userId).first()

    if (!note) {
      throw new Error('Note not found or access denied')
    }

    // Update all flashcards associated with this note
    await Flashcard.query()
      .where('note_id', noteId)
      .where('user_id', userId)
      .update({ needs_update: true })
  }

  /**
   * Generate flashcards from content using AI
   */
  async generateFromContent(
    contentSources: string[],
    flashcardSetId: string,
    userId: string,
    projectId: string
  ): Promise<number> {
    const combined = combineContentSources(contentSources)
    const truncated = truncateToTokenLimit(combined)
    const prompt = createFlashcardPrompt(truncated)

    const response = await getCompletion(prompt, this.model)
    const parsed = extractJsonFromResponse(response)
    const flashcards = parsed?.flashcards || []

    if (flashcards.length === 0) {
      throw new Error('AI failed to generate flashcards')
    }

    await this.saveFlashcardsToDatabase(flashcards, flashcardSetId, userId, projectId)
    return flashcards.length
  }

  /**
   * Save flashcards to database
   */
  private async saveFlashcardsToDatabase(
    flashcards: Array<{ term: string; definition: string }>,
    setId: string,
    userId: string,
    projectId: string
  ): Promise<void> {
    const trx = await Database.transaction()

    try {
      const records = flashcards.map((card) => ({
        id: uuidv4(),
        flashcard_set_id: setId,
        user_id: userId,
        project_id: projectId,
        term: card.term,
        definition: card.definition,
        created_at: DateTime.utc().toSQL(),
        updated_at: DateTime.utc().toSQL(),
      }))

      await trx.table('flashcards').insert(records)
      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}
