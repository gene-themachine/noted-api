/**
 * Libraries Controller
 *
 * Manages file uploads and library items (PDFs, documents, etc.):
 * 1. Generate presigned S3 URLs for direct browser uploads
 * 2. Create library item records after successful upload
 * 3. Retrieve library items (all, by project, by ID)
 * 4. Generate presigned URLs for viewing/downloading
 * 5. Toggle global status (share across projects)
 * 6. Check vectorization status for RAG integration
 *
 * Flow:
 * - Frontend requests presigned URL → Upload to S3 → Confirm upload
 * - Library item triggers vectorization (see library_service.ts)
 * - RAG system uses vectorized content for Q&A
 *
 * Library Items can be:
 * - Project-scoped: Only accessible within one project
 * - Global: Accessible across all user's projects
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import LibraryService from '#services/library_service'
import { isNotFoundError, isPermissionError, isAWSError } from './helpers.js'

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

  // ==========================================
  // S3 Presigned URLs (Direct Upload)
  // ==========================================

  /**
   * Generate presigned S3 URL for direct browser upload
   *
   * Frontend flow:
   * 1. Request presigned URL with fileName and fileType
   * 2. Upload file directly to S3 using presigned URL
   * 3. Call uploadFile() to create library item record
   */
  async getPresignedUrl(ctx: HttpContext) {
    try {
      const payload = await ctx.request.validateUsing(LibrariesController.presignedUrlValidator)

      const result = await this.libraryService.getPresignedUrl({
        fileName: payload.fileName,
        fileType: payload.fileType,
      })

      return ctx.response.json(result)
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      console.error('Presigned URL generation error:', error)

      if (isAWSError(error)) {
        return ctx.response.internalServerError({
          message: 'AWS configuration error. Please check S3 credentials and bucket settings.',
          error: error.message,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to generate presigned URL',
        error: error.message,
      })
    }
  }

  /**
   * Create library item record after successful S3 upload
   *
   * This confirms the upload and triggers vectorization for PDFs
   */
  async uploadFile(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const payload = await ctx.request.validateUsing(LibrariesController.uploadValidator)

      const libraryItem = await this.libraryService.createLibraryItem({
        projectId: payload.projectId,
        key: payload.key,
        fileName: payload.fileName,
        fileType: payload.fileType,
        size: payload.size,
        isGlobal: payload.isGlobal || false,
        userId,
      })

      return ctx.response.created(libraryItem)
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      console.error('Library item creation error:', error)

      if (isNotFoundError(error) || isPermissionError(error)) {
        return ctx.response.notFound({
          message: 'Project not found or access denied',
          error: error.message,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to create library item',
        error: error.message,
      })
    }
  }

  // ==========================================
  // Retrieval Operations
  // ==========================================

  /**
   * Get all library items for the user (across all projects)
   */
  async getAllLibraryItems(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const libraryItems = await this.libraryService.getAllLibraryItems(userId)
      return ctx.response.json(libraryItems)
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to retrieve library items',
      })
    }
  }

  /**
   * Get library items for a specific project
   * Includes global items accessible to this project
   */
  async getProjectLibraryItems(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projectId = ctx.request.param('projectId')

      const libraryItems = await this.libraryService.getProjectLibraryItems(userId, projectId)
      return ctx.response.json(libraryItems)
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Project not found' })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve project library items',
      })
    }
  }

  /**
   * Get a specific library item by ID
   */
  async getLibraryItemById(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const libraryItemId = ctx.request.param('id')

      const libraryItem = await this.libraryService.getLibraryItemById(userId, libraryItemId)
      return ctx.response.json({ data: libraryItem.serialize() })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Library item not found' })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve library item',
      })
    }
  }

  /**
   * Get presigned URL for viewing/downloading a library item
   * Used to display PDFs in browser or trigger download
   */
  async getLibraryItemViewUrl(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const libraryItemId = ctx.request.param('id')

      const result = await this.libraryService.getLibraryItemViewUrl(userId, libraryItemId)
      return ctx.response.json({ url: result.presignedUrl })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Library item not found' })
      }
      return ctx.response.internalServerError({
        message: 'Failed to generate view URL',
      })
    }
  }

  // ==========================================
  // Library Item Management
  // ==========================================

  /**
   * Toggle global status of a library item
   *
   * Global items are accessible across all user's projects
   * Non-global items are scoped to a single project
   */
  async toggleGlobalStatus(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const libraryItemId = ctx.request.param('id')

      const libraryItem = await this.libraryService.toggleGlobalStatus(userId, libraryItemId)
      return ctx.response.ok(libraryItem)
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Library item not found' })
      }
      if (isPermissionError(error)) {
        return ctx.response.forbidden({ message: error.message })
      }
      return ctx.response.internalServerError({
        message: 'Failed to toggle global status',
      })
    }
  }

  /**
   * Get vectorization status for a library item
   *
   * Status values:
   * - pending: Queued for vectorization
   * - processing: Currently being vectorized
   * - completed: Ready for RAG queries
   * - failed: Vectorization error occurred
   */
  async getLibraryItemStatus(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const libraryItemId = ctx.request.param('id')

      const libraryItem = await this.libraryService.getLibraryItemById(userId, libraryItemId)

      return ctx.response.json({
        vectorStatus: libraryItem.vectorStatus,
        processingStatus: libraryItem.processingStatus,
        vectorUpdatedAt: libraryItem.vectorUpdatedAt,
        updatedAt: libraryItem.updatedAt,
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Library item not found' })
      }
      return ctx.response.internalServerError({
        message: 'Failed to get library item status',
      })
    }
  }
}
