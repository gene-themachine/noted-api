import LibraryItem from '#models/library_item'
import AuthorizationService from '#services/authorization_service'
import { getPresignedUrl, getPresignedViewUrl } from '../utils/s3.js'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'

interface CreateLibraryItemData {
  projectId: string
  key: string
  fileName: string
  fileType: string
  size: number
  isGlobal?: boolean
  userId: string
}

interface PresignedUrlData {
  fileName: string
  fileType: string
}

interface PresignedUrlResponse {
  presignedUrl: string
  key: string
  expiresIn: number
}

export default class LibraryService {
  private authService: AuthorizationService

  constructor() {
    this.authService = new AuthorizationService()
  }

  /**
   * Generate presigned URL for file upload
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
   * Create library item after successful upload
   */
  async createLibraryItem(data: CreateLibraryItemData): Promise<LibraryItem> {
    // Verify project access
    const project = await this.authService.getProjectForUser(data.userId, data.projectId)

    const randomId = randomUUID()

    const libraryItem = await LibraryItem.create({
      id: randomId,
      projectId: project.id,
      name: data.fileName,
      mimeType: data.fileType,
      storagePath: data.key,
      size: data.size,
      isGlobal: data.isGlobal || false,
      uploadedAt: DateTime.now(),
    })

    return libraryItem
  }

  /**
   * Get all library items for user (across all their projects)
   */
  async getAllLibraryItems(userId: string): Promise<LibraryItem[]> {
    // Get all project IDs belonging to the user
    const projectIds = await this.authService.getUserProjectIds(userId)

    if (projectIds.length === 0) {
      return []
    }

    // Get all library items for those projects + global items
    const libraryItems = await LibraryItem.query()
      .where((query) => {
        query.whereIn('projectId', projectIds).orWhere('isGlobal', true)
      })
      .orderBy('createdAt', 'desc')

    return libraryItems
  }

  /**
   * Get library items for a specific project
   */
  async getProjectLibraryItems(userId: string, projectId: string): Promise<LibraryItem[]> {
    // Verify project access
    await this.authService.getProjectForUser(userId, projectId)

    const libraryItems = await LibraryItem.query()
      .where((query) => {
        query.where('projectId', projectId).orWhere('isGlobal', true)
      })
      .orderBy('createdAt', 'desc')

    return libraryItems
  }

  /**
   * Get library item by ID with access check
   */
  async getLibraryItemById(userId: string, libraryItemId: string): Promise<LibraryItem> {
    return await this.authService.getLibraryItemForUser(userId, libraryItemId)
  }

  /**
   * Get presigned view URL for a library item
   */
  async getLibraryItemViewUrl(
    userId: string,
    libraryItemId: string
  ): Promise<{ presignedUrl: string; expiresIn: number }> {
    const libraryItem = await this.authService.getLibraryItemForUser(userId, libraryItemId)

    const result = await getPresignedViewUrl(libraryItem.storagePath)

    return {
      presignedUrl: result.presignedUrl,
      expiresIn: result.expiresIn,
    }
  }

  /**
   * Toggle global status of a library item
   */
  async toggleGlobalStatus(userId: string, libraryItemId: string): Promise<LibraryItem> {
    const libraryItem = await LibraryItem.query()
      .where('id', libraryItemId)
      .preload('project')
      .firstOrFail()

    // Only project owners can toggle global status
    if (!libraryItem.project || libraryItem.project.userId !== userId) {
      throw new Error('You do not have permission to modify this library item')
    }

    // Toggle the global status
    await libraryItem.merge({ isGlobal: !libraryItem.isGlobal }).save()

    return libraryItem
  }

  /**
   * Delete library item (only if user owns the project)
   */
  async deleteLibraryItem(userId: string, libraryItemId: string): Promise<void> {
    const libraryItem = await LibraryItem.query()
      .where('id', libraryItemId)
      .preload('project')
      .firstOrFail()

    // Only project owners can delete items
    if (!libraryItem.project || libraryItem.project.userId !== userId) {
      throw new Error('You do not have permission to delete this library item')
    }

    // TODO: Consider deleting the actual file from S3 as well
    // This would require implementing a cleanup service

    await libraryItem.delete()
  }

  /**
   * Update library item metadata
   */
  async updateLibraryItem(
    userId: string,
    libraryItemId: string,
    data: { name?: string; isGlobal?: boolean }
  ): Promise<LibraryItem> {
    const libraryItem = await LibraryItem.query()
      .where('id', libraryItemId)
      .preload('project')
      .firstOrFail()

    // Only project owners can update items
    if (!libraryItem.project || libraryItem.project.userId !== userId) {
      throw new Error('You do not have permission to modify this library item')
    }

    await libraryItem.merge(data).save()

    return libraryItem
  }

  /**
   * Get library items associated with a note
   */
  async getLibraryItemsByNote(userId: string, noteId: string): Promise<LibraryItem[]> {
    // Verify note access
    await this.authService.getNoteForUser(userId, noteId)

    const libraryItems = await LibraryItem.query()
      .where('noteId', noteId)
      .orderBy('createdAt', 'desc')

    return libraryItems
  }

  /**
   * Search library items by name or type
   */
  async searchLibraryItems(
    userId: string,
    query: string,
    projectId?: string,
    mimeType?: string
  ): Promise<LibraryItem[]> {
    let queryBuilder = LibraryItem.query()

    // Filter by project access
    if (projectId) {
      await this.authService.getProjectForUser(userId, projectId)
      queryBuilder = queryBuilder.where((q) => {
        q.where('projectId', projectId).orWhere('isGlobal', true)
      })
    } else {
      const projectIds = await this.authService.getUserProjectIds(userId)
      queryBuilder = queryBuilder.where((q) => {
        q.whereIn('projectId', projectIds).orWhere('isGlobal', true)
      })
    }

    // Filter by search query
    if (query) {
      queryBuilder = queryBuilder.where('name', 'ILIKE', `%${query}%`)
    }

    // Filter by mime type
    if (mimeType) {
      queryBuilder = queryBuilder.where('mimeType', 'ILIKE', `${mimeType}%`)
    }

    const libraryItems = await queryBuilder.orderBy('createdAt', 'desc').limit(50)

    return libraryItems
  }

  /**
   * Get library items statistics for a user
   */
  async getLibraryStatistics(userId: string): Promise<{
    totalItems: number
    totalSize: number
    globalItems: number
    projectItems: number
    byMimeType: Record<string, number>
  }> {
    const projectIds = await this.authService.getUserProjectIds(userId)

    if (projectIds.length === 0) {
      return {
        totalItems: 0,
        totalSize: 0,
        globalItems: 0,
        projectItems: 0,
        byMimeType: {},
      }
    }

    const libraryItems = await LibraryItem.query()
      .where((query) => {
        query.whereIn('projectId', projectIds).orWhere('isGlobal', true)
      })
      .select('size', 'isGlobal', 'mimeType')

    const stats = {
      totalItems: libraryItems.length,
      totalSize: libraryItems.reduce((sum, item) => sum + (item.size || 0), 0),
      globalItems: libraryItems.filter((item) => item.isGlobal).length,
      projectItems: libraryItems.filter((item) => !item.isGlobal).length,
      byMimeType: {} as Record<string, number>,
    }

    // Group by mime type
    libraryItems.forEach((item) => {
      const mimeType = item.mimeType || 'unknown'
      stats.byMimeType[mimeType] = (stats.byMimeType[mimeType] || 0) + 1
    })

    return stats
  }
}
