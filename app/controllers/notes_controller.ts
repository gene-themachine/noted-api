/**
 * Notes Controller
 *
 * Manages notes and folder hierarchy within projects:
 * 1. Notes - Rich text content with TipTap editor
 * 2. Folders - Organize notes in nested tree structure
 * 3. Study Options - Configure which study tools are available
 * 4. Library Items - Attach PDFs/documents to notes for context
 *
 * Key Features:
 * - Nested folder tree stored as JSON in project.folderStructure
 * - Study options control flashcards, multiple choice, free response generation
 * - Library item attachments enable document-aware study materials
 * - Folder/note operations update project tree automatically
 *
 * Related Controllers:
 * - ProjectController handles tree manipulation (move, reorder)
 * - StudyToolsControllers consume notes/library items for generation
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import NoteService from '#services/note_service'
import { isNotFoundError } from './helpers.js'

export default class NotesController {
  private noteService: NoteService

  constructor() {
    this.noteService = new NoteService()
  }

  static createValidator = vine.compile(
    vine.object({
      projectId: vine.string().trim().minLength(1),
      name: vine.string().trim().minLength(1).maxLength(255),
      description: vine.string().trim().optional(),
      content: vine.string().optional(), // Don't trim HTML content!
      folderPath: vine.array(vine.string()).optional(), // Array of folder IDs
    })
  )

  static createFolderValidator = vine.compile(
    vine.object({
      projectId: vine.string().trim().minLength(1),
      name: vine.string().trim().minLength(1).maxLength(255),
      folderPath: vine.array(vine.string()).optional(),
    })
  )

  static deleteFolderValidator = vine.compile(
    vine.object({
      projectId: vine.string().trim().minLength(1),
      folderPath: vine.array(vine.string()), // Path to the folder
    })
  )

  static updateValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1).maxLength(255).optional(),
      content: vine.string().optional(), // Don't trim HTML content!
    })
  )

  static updateStudyOptionsValidator = vine.compile(
    vine.object({
      flashcard: vine.enum(['queued', 'completed', 'failed']).optional(),
      blurtItOut: vine.enum(['queued', 'completed', 'failed']).optional(),
      multipleChoice: vine.enum(['queued', 'completed', 'failed']).optional(),
      fillInTheBlank: vine.enum(['queued', 'completed', 'failed']).optional(),
      matching: vine.enum(['queued', 'completed', 'failed']).optional(),
      shortAnswer: vine.enum(['queued', 'completed', 'failed']).optional(),
      essay: vine.enum(['queued', 'completed', 'failed']).optional(),
    })
  )

  // ==========================================
  // Notes CRUD
  // ==========================================

  /**
   * Create a new note in a project
   * Automatically updates project folder tree
   */
  async createNote(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const payload = await ctx.request.validateUsing(NotesController.createValidator)

      const result = await this.noteService.createNote({
        projectId: payload.projectId,
        name: payload.name,
        content: payload.content,
        folderPath: payload.folderPath,
        userId,
      })

      return ctx.response.created({
        message: 'Note created successfully',
        note: {
          id: result.note.id,
          userId: result.note.userId,
          projectId: result.note.projectId,
          name: result.note.name,
          content: result.note.content,
          createdAt: result.note.createdAt,
          updatedAt: result.note.updatedAt,
        },
        treeNode: result.treeNode,
        project: result.project,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to create note',
      })
    }
  }

  /**
   * Get a single note by ID with all attachments
   */
  async getNoteById(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const noteId = ctx.request.param('noteId')

      const note = await this.noteService.getNoteById(userId, noteId)

      return ctx.response.ok({
        message: 'Note retrieved successfully',
        note,
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve note',
      })
    }
  }

  /**
   * Update note name or content
   */
  async updateNote(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const noteId = ctx.request.param('noteId')
      const payload = await ctx.request.validateUsing(NotesController.updateValidator)

      const note = await this.noteService.updateNote(userId, noteId, payload)

      return ctx.response.ok({
        message: 'Note updated successfully',
        note,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      if (isNotFoundError(error)) {
        return ctx.response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to update note',
      })
    }
  }

  /**
   * Delete a note and remove from project tree
   */
  async deleteNote(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const noteId = ctx.request.param('noteId')

      await this.noteService.deleteNote(userId, noteId)

      return ctx.response.ok({
        message: 'Note deleted successfully',
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to delete note',
      })
    }
  }

  // ==========================================
  // Folder Operations
  // ==========================================

  /**
   * Create a new folder in the project tree
   */
  async createFolder(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const payload = await ctx.request.validateUsing(NotesController.createFolderValidator)

      const result = await this.noteService.createFolder(
        userId,
        payload.projectId,
        payload.name,
        payload.folderPath
      )

      return ctx.response.created({
        message: 'Folder created successfully',
        folder: result.folder,
        project: result.project,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to create folder',
      })
    }
  }

  /**
   * Get project folder tree structure
   * Returns hierarchical JSON representation
   */
  async getProjectTree(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projectId = ctx.request.param('projectId')

      const project = await this.noteService.getProjectTree(userId, projectId)

      return ctx.response.ok({
        message: 'Project tree retrieved successfully',
        project,
      })
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to retrieve project tree',
      })
    }
  }

  /**
   * Delete a folder and all its contents (cascade)
   */
  async deleteFolder(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId, folderId } = ctx.params

      await this.noteService.deleteFolder(userId, projectId, folderId)

      return ctx.response.ok({ message: 'Folder deleted successfully.' })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Folder not found in the project tree.' })
      }
      return ctx.response.internalServerError({ message: 'Failed to delete folder.' })
    }
  }

  // ==========================================
  // Study Options Configuration
  // ==========================================

  /**
   * Get available study options (flashcards, MC, free response, etc.)
   */
  async getAvailableStudyOptions(ctx: HttpContext) {
    const options = this.noteService.getAvailableStudyOptions()
    return ctx.response.ok(options)
  }

  /**
   * Get study options for a specific note
   */
  async getStudyOptions(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const noteId = ctx.request.param('noteId')

      const studyOptions = await this.noteService.getStudyOptions(userId, noteId)

      return ctx.response.ok(studyOptions)
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: error.message })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve study options.',
        error: error.message,
      })
    }
  }

  /**
   * Update study options for a note
   * Controls which study tools are available/enabled
   */
  async updateStudyOptions(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const noteId = ctx.request.param('noteId')
      const payload = await ctx.request.validateUsing(NotesController.updateStudyOptionsValidator)

      const studyOptions = await this.noteService.updateStudyOptions(userId, noteId, payload)

      return ctx.response.ok(studyOptions)
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: error.message })
      }
      return ctx.response.internalServerError({
        message: 'Failed to update study options.',
        error: error.message,
      })
    }
  }

  // ==========================================
  // Library Item Attachments
  // ==========================================

  /**
   * Attach a library item (PDF) to a note
   * Enables document-aware study material generation
   */
  async addLibraryItemToNote(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { noteId, libraryItemId } = ctx.params

      await this.noteService.addLibraryItemToNote(userId, noteId, libraryItemId)

      return ctx.response.ok({ message: 'Library item added to note successfully.' })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: error.message })
      }
      if (error.message.includes('same project')) {
        return ctx.response.badRequest({ message: error.message })
      }
      return ctx.response.internalServerError({ message: 'Failed to add library item to note.' })
    }
  }

  /**
   * Remove a library item attachment from a note
   */
  async removeLibraryItemFromNote(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { noteId, libraryItemId } = ctx.params

      await this.noteService.removeLibraryItemFromNote(userId, noteId, libraryItemId)

      return ctx.response.ok({ message: 'Library item removed from note successfully.' })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: error.message })
      }
      if (error.message.includes('not associated')) {
        return ctx.response.badRequest({ message: error.message })
      }
      return ctx.response.internalServerError({
        message: 'Failed to remove library item from note.',
      })
    }
  }
}
