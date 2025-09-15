import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import LibraryService from '#services/library_service'

export default class LibrariesController {
  private libraryService: LibraryService

  constructor() {
    this.libraryService = new LibraryService()
  }

  static presignedUrlValidator = vine.compile(
    vine.object({
      fileName: vine.string().trim().minLength(1).maxLength(255),
      fileType: vine.string().trim(),
    })
  )

  static uploadValidator = vine.compile(
    vine.object({
      projectId: vine.string().uuid(),
      key: vine.string(),
      fileName: vine.string(),
      fileType: vine.string(),
      size: vine.number().positive(),
      isGlobal: vine.boolean().optional(),
    })
  )

  async getPresignedUrl({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(LibrariesController.presignedUrlValidator)

      const result = await this.libraryService.getPresignedUrl({
        fileName: payload.fileName,
        fileType: payload.fileType,
      })

      return response.json(result)
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      // Log the actual error for debugging
      console.error('Presigned URL generation error:', error)

      // Check for specific AWS errors
      if (error.message?.includes('credentials') || error.message?.includes('AWS')) {
        return response.internalServerError({
          message: 'AWS configuration error. Please check S3 credentials and bucket settings.',
          error: error.message,
        })
      }

      return response.internalServerError({
        message: 'Failed to generate presigned URL',
        error: error.message,
      })
    }
  }

  async uploadFile({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const payload = await request.validateUsing(LibrariesController.uploadValidator)

      const libraryItem = await this.libraryService.createLibraryItem({
        projectId: payload.projectId,
        key: payload.key,
        fileName: payload.fileName,
        fileType: payload.fileType,
        size: payload.size,
        isGlobal: payload.isGlobal || false,
        userId: user.id,
      })

      return response.created(libraryItem)
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      // Log the actual error for debugging
      console.error('Library item creation error:', error)

      // Check for specific authorization errors
      if (error.message?.includes('not found') || error.message?.includes('access')) {
        return response.notFound({
          message: 'Project not found or access denied',
          error: error.message,
        })
      }

      return response.internalServerError({
        message: 'Failed to create library item',
        error: error.message,
      })
    }
  }

  async getAllLibraryItems({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const libraryItems = await this.libraryService.getAllLibraryItems(user.id)
      return response.json(libraryItems)
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve library items',
      })
    }
  }

  async getProjectLibraryItems({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const projectId = request.param('projectId')

      const libraryItems = await this.libraryService.getProjectLibraryItems(user.id, projectId)
      return response.json(libraryItems)
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Project not found' })
      }
      return response.internalServerError({
        message: 'Failed to retrieve project library items',
      })
    }
  }

  async getLibraryItemById({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const libraryItemId = request.param('id')

      const libraryItem = await this.libraryService.getLibraryItemById(user.id, libraryItemId)
      return response.json({ data: libraryItem.serialize() })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Library item not found' })
      }
      return response.internalServerError({
        message: 'Failed to retrieve library item',
      })
    }
  }

  async getLibraryItemViewUrl({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const libraryItemId = request.param('id')

      const result = await this.libraryService.getLibraryItemViewUrl(user.id, libraryItemId)
      return response.json({ url: result.presignedUrl })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Library item not found' })
      }
      return response.internalServerError({
        message: 'Failed to generate view URL',
      })
    }
  }

  async toggleGlobalStatus({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const libraryItemId = request.param('id')

      const libraryItem = await this.libraryService.toggleGlobalStatus(user.id, libraryItemId)
      return response.ok(libraryItem)
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Library item not found' })
      }
      if (error.message.includes('permission')) {
        return response.forbidden({ message: error.message })
      }
      return response.internalServerError({
        message: 'Failed to toggle global status',
      })
    }
  }

  async getLibraryItemStatus({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const libraryItemId = request.param('id')

      const libraryItem = await this.libraryService.getLibraryItemById(user.id, libraryItemId)

      return response.json({
        vectorStatus: libraryItem.vectorStatus,
        processingStatus: libraryItem.processingStatus,
        vectorUpdatedAt: libraryItem.vectorUpdatedAt,
        updatedAt: libraryItem.updatedAt,
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Library item not found' })
      }
      return response.internalServerError({
        message: 'Failed to get library item status',
      })
    }
  }
}
