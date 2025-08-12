import FlashcardSet from '#models/flashcard_set'
import Flashcard from '#models/flashcard'
import Note from '#models/note'
import AuthorizationService from '#services/authorization_service'

export class FlashcardService {
  private authService: AuthorizationService

  constructor() {
    this.authService = new AuthorizationService()
  }

  /**
   * Get project flashcard sets for a user
   */
  async getProjectFlashcardSets(userId: string, projectId: string) {
    // Verify project access
    await this.authService.getProjectForUser(userId, projectId)

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
}
