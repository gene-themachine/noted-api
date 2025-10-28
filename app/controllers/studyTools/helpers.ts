/**
 * Study Tools Controller Helpers
 *
 * Shared utility functions for flashcard, multiple choice, and free response controllers.
 * Reduces code duplication and centralizes common patterns.
 */

import type { HttpContext } from '@adonisjs/core/http'
import Note from '#models/note'
import LibraryItem from '#models/library_item'
import Project from '#models/project'

/**
 * Extract user ID from HTTP context
 *
 * @throws Error if userId not found (middleware not applied)
 * @deprecated Use ctx.userId! directly for type-safe access
 */
export function getUserId(ctx: HttpContext): string {
  const userId = ctx.userId

  if (!userId) {
    throw new Error('Unauthorized: userId not found in context')
  }

  return userId
}

/**
 * Validate content sources (notes and library items) belong to the project
 *
 * Ensures:
 * - At least one content source is selected
 * - All notes belong to the user and project
 * - All library items are either global or belong to the project
 *
 * @throws Error with descriptive message if validation fails
 */
export async function validateContentSources(
  selectedNotes: string[],
  selectedLibraryItems: string[],
  userId: string,
  projectId: string
): Promise<void> {
  // Ensure at least one content source is selected
  if (selectedNotes.length === 0 && selectedLibraryItems.length === 0) {
    throw new Error('At least one note or library item must be selected')
  }

  // Verify all selected notes belong to the user and project
  if (selectedNotes.length > 0) {
    const notes = await Note.query()
      .whereIn('id', selectedNotes)
      .where('user_id', userId)
      .where('project_id', projectId)

    if (notes.length !== selectedNotes.length) {
      throw new Error('Some selected notes are invalid or do not belong to this project')
    }
  }

  // Verify library items if provided
  if (selectedLibraryItems.length > 0) {
    const libraryItems = await LibraryItem.query()
      .whereIn('id', selectedLibraryItems)
      .where((query) => {
        query.where('is_global', true).orWhere('project_id', projectId)
      })

    if (libraryItems.length !== selectedLibraryItems.length) {
      throw new Error('Some selected library items are invalid or not accessible')
    }
  }
}

/**
 * Verify user owns the project
 *
 * @returns Project if found and owned by user
 * @throws Error if project not found or access denied
 */
export async function verifyProjectOwnership(userId: string, projectId: string): Promise<Project> {
  const project = await Project.query().where('id', projectId).where('user_id', userId).first()

  if (!project) {
    throw new Error('Project not found or you do not have access to it')
  }

  return project
}
