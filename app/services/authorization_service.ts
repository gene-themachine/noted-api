import Project from '#models/project'
import Note from '#models/note'
import Flashcard from '#models/flashcard'
import LibraryItem from '#models/library_item'
import MultipleChoiceSet from '#models/multiple_choice_set'

export default class AuthorizationService {
  /**
   * Check if user has access to a project
   */
  async canAccessProject(userId: string, projectId: string): Promise<boolean> {
    const project = await Project.query()
      .where('id', projectId)
      .where('userId', userId)
      .whereNull('deletedAt')
      .first()

    return !!project
  }

  /**
   * Get project if user has access, throws error otherwise
   */
  async getProjectForUser(userId: string, projectId: string): Promise<Project> {
    const project = await Project.query()
      .where('id', projectId)
      .where('userId', userId)
      .whereNull('deletedAt')
      .first()

    if (!project) {
      throw new Error('Project not found or you do not have access to it')
    }

    return project
  }

  /**
   * Check if user has access to a note
   */
  async canAccessNote(userId: string, noteId: string): Promise<boolean> {
    const note = await Note.query().where('id', noteId).where('userId', userId).first()

    return !!note
  }

  /**
   * Get note if user has access, throws error otherwise
   */
  async getNoteForUser(userId: string, noteId: string): Promise<Note> {
    const note = await Note.query().where('id', noteId).where('userId', userId).first()

    if (!note) {
      throw new Error('Note not found or you do not have access to it')
    }

    return note
  }

  /**
   * Check if user has access to a flashcard
   */
  async canAccessFlashcard(userId: string, flashcardId: string): Promise<boolean> {
    const flashcard = await Flashcard.query()
      .where('id', flashcardId)
      .where('userId', userId)
      .first()

    return !!flashcard
  }

  /**
   * Get flashcard if user has access, throws error otherwise
   */
  async getFlashcardForUser(userId: string, flashcardId: string): Promise<Flashcard> {
    const flashcard = await Flashcard.query()
      .where('id', flashcardId)
      .where('userId', userId)
      .first()

    if (!flashcard) {
      throw new Error('Flashcard not found or you do not have access to it')
    }

    return flashcard
  }

  /**
   * Check if user has access to a library item
   * User has access if:
   * 1. The item is global, OR
   * 2. The item belongs to a project the user owns
   */
  async canAccessLibraryItem(userId: string, libraryItemId: string): Promise<boolean> {
    const libraryItem = await LibraryItem.query()
      .where('id', libraryItemId)
      .preload('project')
      .first()

    if (!libraryItem) {
      return false
    }

    // Global items are accessible to all
    if (libraryItem.isGlobal) {
      return true
    }

    // Check if user owns the project
    if (libraryItem.project && libraryItem.project.userId === userId) {
      return true
    }

    return false
  }

  /**
   * Get library item if user has access, throws error otherwise
   */
  async getLibraryItemForUser(userId: string, libraryItemId: string): Promise<LibraryItem> {
    const libraryItem = await LibraryItem.query()
      .where('id', libraryItemId)
      .preload('project')
      .first()

    if (!libraryItem || !(await this.canAccessLibraryItem(userId, libraryItemId))) {
      throw new Error('Library item not found or you do not have access to it')
    }

    return libraryItem
  }

  /**
   * Check if user has access to a multiple choice set
   */
  async canAccessMultipleChoiceSet(userId: string, setId: string): Promise<boolean> {
    const set = await MultipleChoiceSet.query().where('id', setId).where('userId', userId).first()

    return !!set
  }

  /**
   * Get multiple choice set if user has access, throws error otherwise
   */
  async getMultipleChoiceSetForUser(userId: string, setId: string): Promise<MultipleChoiceSet> {
    const set = await MultipleChoiceSet.query().where('id', setId).where('userId', userId).first()

    if (!set) {
      throw new Error('Multiple choice set not found or you do not have access to it')
    }

    return set
  }

  /**
   * Get all project IDs for a user
   */
  async getUserProjectIds(userId: string): Promise<string[]> {
    const projects = await Project.query()
      .where('userId', userId)
      .whereNull('deletedAt')
      .select('id')

    return projects.map((p) => p.id)
  }

  /**
   * Check if note and library item belong to the same project
   */
  async validateNoteLibraryItemRelation(noteId: string, libraryItemId: string): Promise<boolean> {
    const note = await Note.findOrFail(noteId)
    const libraryItem = await LibraryItem.findOrFail(libraryItemId)

    return note.projectId === libraryItem.projectId
  }
}
