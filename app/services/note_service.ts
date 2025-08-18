import Note from '#models/note'
import StudyOptions from '#models/study_options'
import LibraryItem from '#models/library_item'
import AuthorizationService from '#services/authorization_service'
import ProjectService from '#services/project_service'

interface CreateNoteData {
  projectId: string
  name: string
  content?: string
  folderPath?: string[]
  userId: string
}

interface UpdateNoteData {
  name?: string
  content?: string
}

interface StudyOptionsData {
  flashcard?: 'queued' | 'completed' | 'failed' | null
  blurtItOut?: 'queued' | 'completed' | 'failed' | null
  multipleChoice?: 'queued' | 'completed' | 'failed' | null
  fillInTheBlank?: 'queued' | 'completed' | 'failed' | null
  matching?: 'queued' | 'completed' | 'failed' | null
  shortAnswer?: 'queued' | 'completed' | 'failed' | null
  essay?: 'queued' | 'completed' | 'failed' | null
}

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

  /**
   * Get or create a system note for library items within a project.
   * This ensures library items have a valid note_id for vector_chunks foreign key constraint.
   */
  async getOrCreateLibrarySystemNote(projectId: string, userId: string): Promise<Note> {
    const systemNoteName = '__LIBRARY_ITEMS_SYSTEM__'
    
    // Try to find existing system note for this project
    let systemNote = await Note.query()
      .where('projectId', projectId)
      .where('userId', userId)
      .where('name', systemNoteName)
      .first()

    if (!systemNote) {
      // Create system note for library items
      systemNote = await Note.create({
        userId: userId,
        projectId: projectId,
        name: systemNoteName,
        content: 'System note for library items. This note is used internally to maintain database referential integrity for standalone library items that haven\'t been attached to specific notes yet.',
      })

      // Create default study options for system note
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

  /**
   * Create a new note with default study options
   */
  async createNote(data: CreateNoteData): Promise<{ note: Note; treeNode: any; project: any }> {
    // Verify project access
    const project = await this.authService.getProjectForUser(data.userId, data.projectId)

    // Create the note in the database
    const note = await Note.create({
      userId: data.userId,
      projectId: data.projectId,
      name: data.name,
      content: data.content || '',
    })

    // Create default study options
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

    // Add note to project tree
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
      project: {
        id: project.id,
        name: project.name,
        folderTree: project.folderTree,
      },
    }
  }

  /**
   * Get note by ID with authorization check
   */
  async getNoteById(userId: string, noteId: string): Promise<Note> {
    const note = await Note.query()
      .where('id', noteId)
      .where('userId', userId)
      .preload('libraryItems')
      .first()

    if (!note) {
      throw new Error('Note not found or you do not have access to it')
    }

    return note
  }

  /**
   * Update note content and/or name
   */
  async updateNote(userId: string, noteId: string, data: UpdateNoteData): Promise<Note> {
    const note = await this.authService.getNoteForUser(userId, noteId)

    // Update the note
    await note.merge(data).save()

    // If the name changed, update the folder tree as well
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

    // Remove from project tree first
    if (note.projectId) {
      await this.projectService.removeNoteFromProjectTree(userId, note.projectId, noteId)
    }

    // Delete the note from database
    await note.delete()
  }

  /**
   * Get study options for a note
   */
  async getStudyOptions(userId: string, noteId: string): Promise<StudyOptions> {
    // Verify note access
    await this.authService.getNoteForUser(userId, noteId)

    const studyOptions = await StudyOptions.query().where('noteId', noteId).first()

    if (!studyOptions) {
      throw new Error('Study options not found for this note')
    }

    return studyOptions
  }

  /**
   * Update study options for a note
   */
  async updateStudyOptions(
    userId: string,
    noteId: string,
    data: StudyOptionsData
  ): Promise<StudyOptions> {
    // Verify note access
    await this.authService.getNoteForUser(userId, noteId)

    const studyOptions = await StudyOptions.query().where('noteId', noteId).firstOrFail()
    studyOptions.merge(data)
    await studyOptions.save()

    // Real-time updates disabled - using static notifications only

    return studyOptions
  }

  /**
   * Get available study options (static data)
   */
  getAvailableStudyOptions(): Record<string, string> {
    return NoteService.availableStudyOptions
  }

  /**
   * Add library item to note
   */
  async addLibraryItemToNote(userId: string, noteId: string, libraryItemId: string): Promise<void> {
    const note = await this.authService.getNoteForUser(userId, noteId)
    const libraryItem = await LibraryItem.findOrFail(libraryItemId)

    // Ensure the library item belongs to the same project
    if (note.projectId !== libraryItem.projectId) {
      throw new Error('Note and Library Item do not belong to the same project')
    }

    await libraryItem.merge({ noteId: note.id }).save()
  }

  /**
   * Remove library item from note
   */
  async removeLibraryItemFromNote(
    userId: string,
    noteId: string,
    libraryItemId: string
  ): Promise<void> {
    const note = await this.authService.getNoteForUser(userId, noteId)
    const libraryItem = await LibraryItem.findOrFail(libraryItemId)

    // Ensure the library item is actually associated with the note
    if (libraryItem.noteId !== note.id) {
      throw new Error('Library item is not associated with this note')
    }

    // Remove association (sets noteId to null)
    await libraryItem.merge({ noteId: null }).save()

    console.log(`🔄 Document detached from note: library item ${libraryItemId} removed from note ${noteId}`)
    
    // The LibraryItem model's afterSave hook will trigger metadata update
    // to move vectors back to system note when noteId changes to null
  }

  /**
   * Create a folder in project tree
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
      folder: {
        id: folderNode.id,
        name: folderNode.name,
        type: folderNode.type,
      },
      project: {
        id: project.id,
        name: project.name,
        folderTree: project.folderTree,
      },
    }
  }

  /**
   * Delete a folder from project tree
   */
  async deleteFolder(userId: string, projectId: string, folderId: string): Promise<void> {
    await this.projectService.removeFolderFromTree(userId, projectId, folderId)
  }

  /**
   * Get project tree structure
   */
  async getProjectTree(userId: string, projectId: string): Promise<any> {
    return await this.projectService.getProjectTree(userId, projectId)
  }
}
