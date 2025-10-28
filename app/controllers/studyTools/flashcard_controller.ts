/**
 * Flashcard Controller
 *
 * Manages flashcard study sets with AI-powered generation:
 * 1. User selects notes/library items as source material
 * 2. AI generates flashcard pairs (term + definition) from content
 * 3. User can star individual flashcards for quick review
 * 4. Sets track which sources they were generated from
 *
 * Flow:
 * - Create Set → Validate Sources → AI Generation → Save to DB
 * - Star/Unstar → Project-level starred collections
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import FlashcardSet from '#models/flashcard_set'
import Flashcard from '#models/flashcard'
import { FlashcardService } from '#services/studyTools/flashcard_service'
import AIService from '#services/ai_service'
import { validateContentSources, verifyProjectOwnership } from './helpers.js'

export default class FlashcardController {
  private flashcardService = new FlashcardService()
  private aiService = new AIService()

  static createFlashcardSetValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1),
      selectedNotes: vine.array(vine.string()).optional(),
      selectedLibraryItems: vine.array(vine.string()).optional(),
    })
  )

  static updateFlashcardSetValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1),
    })
  )

  // ==========================================
  // CRUD Operations for Flashcard Sets
  // ==========================================

  /**
   * Get all flashcard sets for a project
   * Returns sets with their associated notes, library items, and flashcards
   */
  async getProjectFlashcardSets(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId } = ctx.params

      const flashcardSets = await this.flashcardService.getProjectFlashcardSets(userId, projectId)

      return ctx.response.ok({
        message: 'Flashcard sets retrieved successfully',
        data: flashcardSets,
      })
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to retrieve flashcard sets',
        error: error.message,
      })
    }
  }

  /**
   * Create a new flashcard set with AI generation
   *
   * Process:
   * 1. Validate input and content sources
   * 2. Create flashcard set record
   * 3. Attach source notes/library items
   * 4. Generate flashcards using AI
   * 5. If generation fails, rollback the set creation
   */
  async createProjectFlashcardSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId } = ctx.params
      const payload = await ctx.request.validateUsing(
        FlashcardController.createFlashcardSetValidator
      )

      const selectedNotes = payload.selectedNotes || []
      const selectedLibraryItems = payload.selectedLibraryItems || []

      // Validate content sources (helper handles all validation)
      try {
        await validateContentSources(selectedNotes, selectedLibraryItems, userId, projectId)
      } catch (validationError) {
        return ctx.response.badRequest({ message: validationError.message })
      }

      // Create the flashcard set
      const flashcardSet = await FlashcardSet.create({
        name: payload.name,
        userId,
        projectId,
      })

      // Attach source content
      if (selectedNotes.length > 0) {
        await flashcardSet.related('notes').attach(selectedNotes)
      }
      if (selectedLibraryItems.length > 0) {
        await flashcardSet.related('libraryItems').attach(selectedLibraryItems)
      }

      // Generate flashcards using AI
      console.log('Starting flashcard generation:', {
        flashcardSetId: flashcardSet.id,
        userId,
        projectId,
        notesCount: selectedNotes.length,
        libraryItemsCount: selectedLibraryItems.length,
      })

      try {
        const result = await this.aiService.generateFlashcardSet({
          flashcardSetId: flashcardSet.id,
          userId,
          projectId,
          selectedNoteIds: selectedNotes,
          selectedLibraryItemIds: selectedLibraryItems,
        })

        console.log('✅ Flashcard generation completed successfully')

        return ctx.response.created({
          ...flashcardSet.serialize(),
          type: 'flashcard',
          message: `Flashcard set created successfully with ${result.flashcardsCount} flashcards`,
          status: 'completed',
          flashcardsCount: result.flashcardsCount,
        })
      } catch (generationError) {
        console.error('❌ Failed to generate flashcards:', generationError)
        // Rollback: Delete the created set if generation failed
        await flashcardSet.delete()
        throw new Error(`Failed to generate flashcards: ${generationError.message}`)
      }
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to create flashcard set',
        error: error.message,
      })
    }
  }

  /**
   * Get a specific flashcard set with all its flashcards
   */
  async getFlashcardSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { setId } = ctx.params

      const flashcardSet = await this.flashcardService.getFlashcardSet(userId, setId)

      return ctx.response.ok({
        message: 'Flashcard set retrieved successfully',
        data: flashcardSet,
      })
    } catch (error) {
      if (error.message === 'Flashcard set not found or access denied') {
        return ctx.response.notFound({
          message: 'Flashcard set not found or you do not have access to it',
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve flashcard set',
        error: error.message,
      })
    }
  }

  /**
   * Update a flashcard set's name
   */
  async updateProjectFlashcardSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { setId } = ctx.params
      const payload = await ctx.request.validateUsing(
        FlashcardController.updateFlashcardSetValidator
      )

      const updatedFlashcardSet = await this.flashcardService.updateFlashcardSet(
        userId,
        setId,
        payload
      )

      return ctx.response.ok({
        message: 'Flashcard set updated successfully',
        data: updatedFlashcardSet,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (error.message === 'Flashcard set not found or access denied') {
        return ctx.response.notFound({
          message: 'Flashcard set not found or you do not have access to it',
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to update flashcard set',
        error: error.message,
      })
    }
  }

  /**
   * Delete a flashcard set and all its flashcards (CASCADE)
   */
  async deleteFlashcardSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { setId } = ctx.params

      await this.flashcardService.deleteFlashcardSet(userId, setId)

      return ctx.response.ok({
        message: 'Flashcard set deleted successfully',
      })
    } catch (error) {
      if (error.message === 'Flashcard set not found or access denied') {
        return ctx.response.notFound({
          message: 'Flashcard set not found or you do not have access to it',
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to delete flashcard set',
        error: error.message,
      })
    }
  }

  /**
   * Mark flashcards as needing update when source note changes
   * Used to notify users that flashcards may be outdated
   */
  async markFlashcardsAsNeedingUpdate(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { noteId } = ctx.params

      await this.flashcardService.markFlashcardsAsNeedingUpdate(userId, noteId)

      return ctx.response.ok({
        message: 'Flashcards marked as needing update successfully',
      })
    } catch (error) {
      if (error.message === 'Note not found or access denied') {
        return ctx.response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to mark flashcards as needing update',
        error: error.message,
      })
    }
  }

  // ==========================================
  // Starred Flashcards (Quick Review)
  // ==========================================

  /**
   * Get all starred flashcards for a project
   * Allows users to create a custom review collection
   */
  async getProjectStarredFlashcards(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId } = ctx.params

      const project = await verifyProjectOwnership(userId, projectId)

      // Load starred flashcards with their flashcard set information
      await project.load('starredFlashcards', (query) => {
        query.preload('flashcardSet')
      })

      return ctx.response.ok({
        message: 'Starred flashcards retrieved successfully',
        data: project.starredFlashcards,
      })
    } catch (error) {
      return ctx.response.notFound({ message: error.message })
    }
  }

  /**
   * Star a flashcard for quick review
   * Adds to project-level starred collection
   */
  async starFlashcard(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId, flashcardId } = ctx.params

      const project = await verifyProjectOwnership(userId, projectId)

      // Verify flashcard exists and belongs to a flashcard set in this project
      const flashcard = await Flashcard.query()
        .where('id', flashcardId)
        .preload('flashcardSet', (query) => {
          query.where('project_id', projectId)
        })
        .first()

      if (!flashcard || !flashcard.flashcardSet) {
        return ctx.response.notFound({
          message: 'Flashcard not found or does not belong to this project',
        })
      }

      // Add to starred flashcards (attach will ignore duplicates)
      await project.related('starredFlashcards').attach([flashcardId])

      return ctx.response.ok({
        message: 'Flashcard starred successfully',
      })
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to star flashcard',
        error: error.message,
      })
    }
  }

  /**
   * Unstar a flashcard
   * Removes from project-level starred collection
   */
  async unstarFlashcard(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId, flashcardId } = ctx.params

      const project = await verifyProjectOwnership(userId, projectId)

      // Remove from starred flashcards
      await project.related('starredFlashcards').detach([flashcardId])

      return ctx.response.ok({
        message: 'Flashcard unstarred successfully',
      })
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to unstar flashcard',
        error: error.message,
      })
    }
  }
}
