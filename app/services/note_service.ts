/**
 * Note Service
 *
 * Manages notes, their content, study options, and library item attachments.
 *
 * Core Concepts:
 * - **Notes**: User's study materials with rich text content
 * - **Study Options**: Configure which study tools are available (flashcards, MC, FR)
 * - **Library Items**: PDFs/documents attached to notes for context
 * - **Folder Tree**: Hierarchical organization (delegated to ProjectService)
 * - **System Note**: Special hidden note for standalone library items (vectorization requirement)
 *
 * Data Flow:
 * 1. Create note → auto-create StudyOptions → add to project tree
 * 2. Update note content → optionally trigger vectorization
 * 3. Attach library item → triggers vectorization with note context
 * 4. Delete note → remove from tree → cascade delete
 *
 * Used by: NotesController
 */

import Note from '#models/note'
import StudyOptions from '#models/study_options'
import LibraryItem from '#models/library_item'
import AuthorizationService from '#services/authorization_service'
import ProjectService from '#services/project_service'
import { CreateNoteData, UpdateNoteData, StudyOptionsData } from '#types/note.types'

export default class NoteService {
  private authService: AuthorizationService
  private projectService: ProjectService

  static availableStudyOptions = {
    flashcard: 'Flashcard',
    blurtItOut: 'Blurt It Out',
    multipleChoice: 'Multiple Choice',
    fillInTheBlank: 'Fill In The Blank',
    matching: 'Matching',
    shortAnswer: 'Short Answer',
    essay: 'Essay',
  }

  constructor() {
    this.authService = new AuthorizationService()
    this.projectService = new ProjectService()
  }

  // ========== Note CRUD ==========

  /**
   * Create note with default study options and add to project tree
   *
   * @returns Note, tree node, and updated project
   */
  async createNote(data: CreateNoteData): Promise<{ note: Note; treeNode: any; project: any }> {
    const project = await this.authService.getProjectForUser(data.userId, data.projectId)

    const note = await Note.create({
      userId: data.userId,
      projectId: data.projectId,
      name: data.name,
      content: data.content || '',
    })

    // Create default study options (all null initially)
    await StudyOptions.create({
      noteId: note.id,
      flashcard: null,
      blurtItOut: null,
      multipleChoice: null,
      fillInTheBlank: null,
      matching: null,
      shortAnswer: null,
      essay: null,
    })

    // Add to project tree
    const { noteNode } = await this.projectService.addNoteToTree(
      data.userId,
      data.projectId,
      note.id,
      data.name,
      data.folderPath || []
    )

    return {
      note,
      treeNode: noteNode,
      project: { id: project.id, name: project.name, folderTree: project.folderTree },
    }
  }

  /**
   * Get note by ID with library items preloaded
   *
   * @throws Error if note doesn't exist or user doesn't own it
   */
  async getNoteById(userId: string, noteId: string): Promise<Note> {
    const note = await Note.query()
      .where('id', noteId)
      .where('userId', userId)
      .preload('libraryItems')
      .first()

    if (!note) throw new Error('Note not found or you do not have access to it')
    return note
  }

  /**
   * Update note content/name and sync tree if name changed
   */
  async updateNote(userId: string, noteId: string, data: UpdateNoteData): Promise<Note> {
    const note = await this.authService.getNoteForUser(userId, noteId)

    await note.merge(data).save()

    // Sync folder tree if name changed
    if (data.name && note.projectId) {
      await this.projectService.updateNoteNameInTree(userId, note.projectId, noteId, data.name)
    }

    return note
  }

  /**
   * Delete note and remove from project tree
   */
  async deleteNote(userId: string, noteId: string): Promise<void> {
    const note = await this.authService.getNoteForUser(userId, noteId)

    if (note.projectId) {
      await this.projectService.removeNoteFromProjectTree(userId, note.projectId, noteId)
    }

    await note.delete()
  }

  // ========== Study Options ==========

  /**
   * Get study options for note
   */
  async getStudyOptions(userId: string, noteId: string): Promise<StudyOptions> {
    await this.authService.getNoteForUser(userId, noteId)
    const studyOptions = await StudyOptions.query().where('noteId', noteId).first()
    if (!studyOptions) throw new Error('Study options not found for this note')
    return studyOptions
  }

  /**
   * Update study options (which study tools are enabled)
   */
  async updateStudyOptions(
    userId: string,
    noteId: string,
    data: StudyOptionsData
  ): Promise<StudyOptions> {
    await this.authService.getNoteForUser(userId, noteId)
    const studyOptions = await StudyOptions.query().where('noteId', noteId).firstOrFail()
    studyOptions.merge(data)
    await studyOptions.save()
    return studyOptions
  }

  /**
   * Get available study options (static list)
   */
  getAvailableStudyOptions(): Record<string, string> {
    return NoteService.availableStudyOptions
  }

  // ========== Library Item Attachments ==========

  /**
   * Attach library item to note
   *
   * When attached, library item vectors are re-indexed with note context.
   * Triggers vectorization via LibraryItem model afterSave hook.
   */
  async addLibraryItemToNote(userId: string, noteId: string, libraryItemId: string): Promise<void> {
    const note = await this.authService.getNoteForUser(userId, noteId)
    const libraryItem = await LibraryItem.findOrFail(libraryItemId)

    if (note.projectId !== libraryItem.projectId) {
      throw new Error('Note and Library Item do not belong to the same project')
    }

    await libraryItem.merge({ noteId: note.id }).save()
  }

  /**
   * Detach library item from note
   *
   * Vectors are moved back to system note (preserves vectorization).
   * Triggers metadata update via LibraryItem model afterSave hook.
   */
  async removeLibraryItemFromNote(
    userId: string,
    noteId: string,
    libraryItemId: string
  ): Promise<void> {
    const note = await this.authService.getNoteForUser(userId, noteId)
    const libraryItem = await LibraryItem.findOrFail(libraryItemId)

    if (libraryItem.noteId !== note.id) {
      throw new Error('Library item is not associated with this note')
    }

    await libraryItem.merge({ noteId: null }).save()
    console.log(`🔄 Document detached: library item ${libraryItemId} from note ${noteId}`)
  }

  // ========== Folder Management (Delegated to ProjectService) ==========

  /**
   * Create folder in project tree
   */
  async createFolder(
    userId: string,
    projectId: string,
    folderName: string,
    folderPath: string[] = []
  ): Promise<{ folder: any; project: any }> {
    const { project, folderNode } = await this.projectService.addFolderToTree(
      userId,
      projectId,
      folderName,
      folderPath
    )

    return {
      folder: { id: folderNode.id, name: folderNode.name, type: folderNode.type },
      project: { id: project.id, name: project.name, folderTree: project.folderTree },
    }
  }

  /**
   * Delete folder from project tree
   */
  async deleteFolder(userId: string, projectId: string, folderId: string): Promise<void> {
    await this.projectService.removeFolderFromTree(userId, projectId, folderId)
  }

  /**
   * Get project tree structure
   */
  async getProjectTree(userId: string, projectId: string): Promise<any> {
    return this.projectService.getProjectTree(userId, projectId)
  }

  // ========== Internal Helpers ==========

  /**
   * Get or create system note for standalone library items
   *
   * System Note Purpose:
   * - Library items need a noteId for vector_chunks foreign key
   * - When library item isn't attached to user note, it uses system note
   * - Hidden from user (name: __LIBRARY_ITEMS_SYSTEM__)
   * - One per project
   */
  async getOrCreateLibrarySystemNote(projectId: string, userId: string): Promise<Note> {
    const systemNoteName = '__LIBRARY_ITEMS_SYSTEM__'

    let systemNote = await Note.query()
      .where('projectId', projectId)
      .where('userId', userId)
      .where('name', systemNoteName)
      .first()

    if (!systemNote) {
      systemNote = await Note.create({
        userId,
        projectId,
        name: systemNoteName,
        content:
          "System note for library items. This note is used internally to maintain database referential integrity for standalone library items that haven't been attached to specific notes yet.",
      })

      await StudyOptions.create({
        noteId: systemNote.id,
        flashcard: null,
        blurtItOut: null,
        multipleChoice: null,
        fillInTheBlank: null,
        matching: null,
        shortAnswer: null,
        essay: null,
      })

      console.log(`📝 Created system note for library items in project ${projectId}`)
    }

    return systemNote
  }
}
