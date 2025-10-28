/**
 * Library Service
 *
 * Manages file uploads (PDFs, documents) stored in S3.
 *
 * Key Concepts:
 * - **Upload Flow**: Frontend gets presigned URL → uploads directly to S3 → creates library item record
 * - **Global Items**: Can be shared across all projects (toggled by project owner)
 * - **Project Items**: Belong to a single project
 * - **Vectorization**: PDFs are automatically vectorized when attached to notes (see NativeVectorService)
 *
 * Used by: LibrariesController
 */

import LibraryItem from '#models/library_item'
import AuthorizationService from '#services/authorization_service'
import { getPresignedUrl, getPresignedViewUrl } from '../utils/s3.js'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import { CreateLibraryItemData, PresignedUrlData, PresignedUrlResponse } from '#types/library.types'

export default class LibraryService {
  private authService: AuthorizationService

  constructor() {
    this.authService = new AuthorizationService()
  }

  // ========== Public Methods ==========

  /**
   * Generate presigned S3 URL for file upload
   *
   * @returns Presigned URL (expires in 5 minutes), S3 key, expiration time
   */
  async getPresignedUrl(data: PresignedUrlData): Promise<PresignedUrlResponse> {
    const result = await getPresignedUrl(data.fileName, data.fileType)

    return {
      presignedUrl: result.presignedUrl,
      key: result.key,
      expiresIn: result.expiresIn,
    }
  }

  /**
   * Create library item record after S3 upload
   *
   * @param data - File metadata (fileName, fileType, S3 key, size, projectId)
   * @returns Created library item
   * @throws Error if user doesn't own the project
   */
  async createLibraryItem(data: CreateLibraryItemData): Promise<LibraryItem> {
    const project = await this.authService.getProjectForUser(data.userId, data.projectId)

    return LibraryItem.create({
      id: randomUUID(),
      projectId: project.id,
      name: data.fileName,
      mimeType: data.fileType,
      storagePath: data.key,
      size: data.size,
      isGlobal: data.isGlobal || false,
      uploadedAt: DateTime.now(),
    })
  }

  /**
   * Get all library items across user's projects
   *
   * Returns items from all projects user owns + global items
   */
  async getAllLibraryItems(userId: string): Promise<LibraryItem[]> {
    const projectIds = await this.authService.getUserProjectIds(userId)
    if (projectIds.length === 0) return []

    return LibraryItem.query()
      .where((query) => {
        query.whereIn('projectId', projectIds).orWhere('isGlobal', true)
      })
      .orderBy('createdAt', 'desc')
  }

  /**
   * Get library items for specific project
   *
   * Returns project items + global items (shared across all projects)
   */
  async getProjectLibraryItems(_userId: string, projectId: string): Promise<LibraryItem[]> {
    return LibraryItem.query()
      .where((query) => {
        query.where('projectId', projectId).orWhere('isGlobal', true)
      })
      .orderBy('createdAt', 'desc')
  }

  /**
   * Get library item by ID with access check
   */
  async getLibraryItemById(userId: string, libraryItemId: string): Promise<LibraryItem> {
    return this.authService.getLibraryItemForUser(userId, libraryItemId)
  }

  /**
   * Get presigned URL for viewing/downloading a file
   *
   * @returns Presigned URL (expires in 15 minutes) and expiration time
   * @throws Error if user doesn't have access to the item
   */
  async getLibraryItemViewUrl(
    userId: string,
    libraryItemId: string
  ): Promise<{ presignedUrl: string; expiresIn: number }> {
    const libraryItem = await this.authService.getLibraryItemForUser(userId, libraryItemId)
    const result = await getPresignedViewUrl(libraryItem.storagePath)
    return { presignedUrl: result.presignedUrl, expiresIn: result.expiresIn }
  }

  /**
   * Toggle global status (project-only ↔ shared across all projects)
   *
   * Only project owner can toggle. Global items appear in all projects.
   */
  async toggleGlobalStatus(userId: string, libraryItemId: string): Promise<LibraryItem> {
    const libraryItem = await LibraryItem.query()
      .where('id', libraryItemId)
      .preload('project')
      .firstOrFail()

    if (!libraryItem.project || libraryItem.project.userId !== userId) {
      throw new Error('You do not have permission to modify this library item')
    }

    await libraryItem.merge({ isGlobal: !libraryItem.isGlobal }).save()
    return libraryItem
  }
}
