/**
 * Content Fetcher Service
 *
 * Handles fetching and extracting content from various sources. Used in various services files:
 * - Notes (text content)
 * - Library items (PDF extraction, etc.)
 */

import Note from '#models/note'
import LibraryItem from '#models/library_item'
import { downloadAndExtractText } from '../utils/pdf_extractor.js'

export default class ContentFetcherService {
  /**
   * Fetch content from notes and library items
   *
   * @param noteIds - Array of note IDs to fetch
   * @param libraryItemIds - Array of library item IDs to fetch
   * @param userId - User ID for authorization
   * @param projectId - Project ID for authorization
   * @returns Combined content from all sources
   */
  async fetchContent(
    noteIds: string[],
    libraryItemIds: string[],
    userId: string,
    projectId: string
  ): Promise<string[]> {
    const contentSources: string[] = []

    // Fetch notes
    for (const noteId of noteIds) {
      const note = await this.fetchNote(noteId, userId)
      if (note?.content?.trim()) {
        contentSources.push(`=== Note: ${note.name || 'Untitled'} ===\n${note.content}`)
      }
    }

    // Fetch library items
    if (libraryItemIds.length > 0) {
      const items = await this.fetchLibraryItems(libraryItemIds, projectId)
      const fileContent = await this.extractFromFiles(items)
      if (fileContent.trim()) {
        contentSources.push(fileContent)
      }
    }

    return contentSources
  }

  /**
   * Fetch a single note
   */
  private async fetchNote(noteId: string, userId: string): Promise<Note | null> {
    return Note.query().where('id', noteId).where('user_id', userId).first()
  }

  /**
   * Fetch multiple library items
   */
  private async fetchLibraryItems(itemIds: string[], projectId: string): Promise<LibraryItem[]> {
    return LibraryItem.query()
      .whereIn('id', itemIds)
      .where((query) => {
        query.where('is_global', true).orWhere('project_id', projectId)
      })
  }

  /**
   * Extract text content from library item files (PDFs, etc.)
   */
  private async extractFromFiles(items: LibraryItem[]): Promise<string> {
    const contents: string[] = []

    for (const item of items) {
      try {
        let s3Key = item.storagePath
        // Extract S3 key from full URL if needed
        if (s3Key.startsWith('http')) {
          s3Key = s3Key.split('amazonaws.com/')[1]
        }

        const text = await downloadAndExtractText(s3Key)
        if (text) {
          contents.push(`=== ${item.name} ===\n${text}`)
        }
      } catch (error) {
        console.error(`Failed to extract from ${item.name}:`, error)
      }
    }

    return contents.join('\n')
  }
}
