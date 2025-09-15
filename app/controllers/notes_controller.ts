import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import NoteService from '#services/note_service'

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
      content: vine.string().trim().optional(),
      folderPath: vine.array(vine.string()).optional(), // Array of folder IDs representing the path
    })
  )

  static createFolderValidator = vine.compile(
    vine.object({
      projectId: vine.string().trim().minLength(1),
      name: vine.string().trim().minLength(1).maxLength(255),
      folderPath: vine.array(vine.string()).optional(), // Array of folder IDs representing the path
    })
  )

  static deleteFolderValidator = vine.compile(
    vine.object({
      projectId: vine.string().trim().minLength(1),
      folderPath: vine.array(vine.string()), // Array of folder IDs representing the path to the folder
    })
  )

  // Create a new note
  async createNote({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) {
        throw new Error('Unauthorized')
      }
      const payload = await request.validateUsing(NotesController.createValidator)

      const result = await this.noteService.createNote({
        projectId: payload.projectId,
        name: payload.name,
        content: payload.content,
        folderPath: payload.folderPath,
        userId,
      })

      return response.created({
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
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to create note',
      })
    }
  }

  // Create a new folder
  async createFolder({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const payload = await request.validateUsing(NotesController.createFolderValidator)

      const result = await this.noteService.createFolder(
        userId,
        payload.projectId,
        payload.name,
        payload.folderPath
      )

      return response.created({
        message: 'Folder created successfully',
        folder: result.folder,
        project: result.project,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to create folder',
      })
    }
  }

  // Get project folder tree
  async getProjectTree({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const projectId = request.param('projectId')

      const project = await this.noteService.getProjectTree(userId, projectId)

      return response.ok({
        message: 'Project tree retrieved successfully',
        project,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve project tree',
      })
    }
  }

  // Get a single note by its ID
  async getNoteById({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const noteId = request.param('noteId')

      const note = await this.noteService.getNoteById(userId, noteId)

      return response.ok({
        message: 'Note retrieved successfully',
        note,
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }
      return response.internalServerError({
        message: 'Failed to retrieve note',
      })
    }
  }

  // Get study options for a note
  async getStudyOptions({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const noteId = request.param('noteId')

      const studyOptions = await this.noteService.getStudyOptions(userId, noteId)

      return response.ok(studyOptions)
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: error.message })
      }
      return response.internalServerError({
        message: 'Failed to retrieve study options.',
        error: error.message,
      })
    }
  }

  async getAvailableStudyOptions({ response }: HttpContext) {
    const options = this.noteService.getAvailableStudyOptions()
    return response.ok(options)
  }

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

  // Update study options for a note
  async updateStudyOptions({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const noteId = request.param('noteId')
      const payload = await request.validateUsing(NotesController.updateStudyOptionsValidator)

      const studyOptions = await this.noteService.updateStudyOptions(userId, noteId, payload)

      return response.ok(studyOptions)
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      if (error.message.includes('not found')) {
        return response.notFound({ message: error.message })
      }
      return response.internalServerError({
        message: 'Failed to update study options.',
        error: error.message,
      })
    }
  }

  // Update note validator
  static updateValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1).maxLength(255).optional(),
      content: vine.string().trim().optional(),
    })
  )

  // Update a note by its ID
  async updateNote({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const noteId = request.param('noteId')
      const payload = await request.validateUsing(NotesController.updateValidator)

      const note = await this.noteService.updateNote(userId, noteId, payload)

      return response.ok({
        message: 'Note updated successfully',
        note,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      if (error.message.includes('not found')) {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }

      return response.internalServerError({
        message: 'Failed to update note',
      })
    }
  }

  // Delete a note by its ID
  async deleteNote({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const noteId = request.param('noteId')

      await this.noteService.deleteNote(userId, noteId)

      return response.ok({
        message: 'Note deleted successfully',
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }
      return response.internalServerError({
        message: 'Failed to delete note',
      })
    }
  }

  async deleteFolder({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const { projectId, folderId } = request.params()

      await this.noteService.deleteFolder(userId, projectId, folderId)

      return response.ok({ message: 'Folder deleted successfully.' })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Folder not found in the project tree.' })
      }
      return response.internalServerError({ message: 'Failed to delete folder.' })
    }
  }

  async addLibraryItemToNote({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const { noteId, libraryItemId } = request.params()

      await this.noteService.addLibraryItemToNote(userId, noteId, libraryItemId)

      return response.ok({ message: 'Library item added to note successfully.' })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: error.message })
      }
      if (error.message.includes('same project')) {
        return response.badRequest({ message: error.message })
      }
      return response.internalServerError({ message: 'Failed to add library item to note.' })
    }
  }

  async removeLibraryItemFromNote({ request, response }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId || undefined
      if (!userId) throw new Error('Unauthorized')
      const { noteId, libraryItemId } = request.params()

      await this.noteService.removeLibraryItemFromNote(userId, noteId, libraryItemId)

      return response.ok({ message: 'Library item removed from note successfully.' })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: error.message })
      }
      if (error.message.includes('not associated')) {
        return response.badRequest({ message: error.message })
      }
      return response.internalServerError({ message: 'Failed to remove library item from note.' })
    }
  }
}
