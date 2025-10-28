/**
 * Multiple Choice Controller
 *
 * Manages multiple choice quiz sets with AI-powered generation:
 * 1. User selects notes/library items as source material
 * 2. AI generates multiple choice questions with 4 options each
 * 3. One correct answer per question
 * 4. User can star individual questions for quick review
 *
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import MultipleChoiceSet from '#models/multiple_choice_set'
import MultipleChoiceQuestion from '#models/multiple_choice_question'
import { MultipleChoiceService } from '#services/studyTools/multiple_choice_service'
import AIService from '#services/ai_service'
import { validateContentSources, verifyProjectOwnership } from './helpers.js'

export default class MultipleChoiceController {
  private multipleChoiceService = new MultipleChoiceService()
  private aiService = new AIService()

  static createProjectMultipleChoiceSetValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1),
      selectedNotes: vine.array(vine.string()).optional(),
      selectedLibraryItems: vine.array(vine.string()).optional(),
    })
  )

  static updateMultipleChoiceSetValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1),
    })
  )

  // ==========================================
  // CRUD Operations for Multiple Choice Sets
  // ==========================================

  /**
   * Get all multiple choice sets for a project
   */
  async getProjectMultipleChoiceSets(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId } = ctx.params

      const multipleChoiceSets = await this.multipleChoiceService.getProjectMultipleChoiceSets(
        userId,
        projectId
      )

      return ctx.response.ok({
        message: 'Multiple choice sets retrieved successfully',
        data: multipleChoiceSets.map((set) => ({
          ...set.serialize(),
          type: 'multiple_choice',
        })),
      })
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to retrieve multiple choice sets',
        error: error.message,
      })
    }
  }

  /**
   * Create a new multiple choice set with AI generation
   *
   * Process:
   * 1. Validate input and content sources
   * 2. Create multiple choice set record
   * 3. Attach source notes/library items
   * 4. Generate questions using AI
   * 5. If generation fails, rollback the set creation
   */
  async createProjectMultipleChoiceSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId } = ctx.params
      const payload = await ctx.request.validateUsing(
        MultipleChoiceController.createProjectMultipleChoiceSetValidator
      )

      const selectedNotes = payload.selectedNotes || []
      const selectedLibraryItems = payload.selectedLibraryItems || []

      // Validate content sources
      try {
        await validateContentSources(selectedNotes, selectedLibraryItems, userId, projectId)
      } catch (validationError) {
        return ctx.response.badRequest({ message: validationError.message })
      }

      // Create the multiple choice set
      const multipleChoiceSet = await MultipleChoiceSet.create({
        name: payload.name,
        userId,
        projectId,
      })

      // Attach source content
      if (selectedNotes.length > 0) {
        await multipleChoiceSet.related('notes').attach(selectedNotes)
      }
      if (selectedLibraryItems.length > 0) {
        await multipleChoiceSet.related('libraryItems').attach(selectedLibraryItems)
      }

      // Generate multiple choice questions using AI
      console.log('Starting multiple choice generation:', {
        multipleChoiceSetId: multipleChoiceSet.id,
        userId,
        projectId,
        notesCount: selectedNotes.length,
        libraryItemsCount: selectedLibraryItems.length,
      })

      try {
        const result = await this.aiService.generateMultipleChoiceSet({
          multipleChoiceSetId: multipleChoiceSet.id,
          userId,
          projectId,
          selectedNoteIds: selectedNotes,
          selectedLibraryItemIds: selectedLibraryItems,
        })

        console.log('✅ Multiple choice generation completed successfully')

        return ctx.response.created({
          ...multipleChoiceSet.serialize(),
          type: 'multiple_choice',
          message: `Multiple choice set created successfully with ${result.questionsCount} questions`,
          status: 'completed',
          questionsCount: result.questionsCount,
        })
      } catch (generationError) {
        console.error('❌ Failed to generate multiple choice questions:', generationError)
        // Rollback: Delete the created set if generation failed
        await multipleChoiceSet.delete()
        throw new Error(`Failed to generate multiple choice questions: ${generationError.message}`)
      }
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to create multiple choice set',
        error: error.message,
      })
    }
  }

  /**
   * Get a specific multiple choice set with all its questions
   */
  async getProjectMultipleChoiceSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { setId } = ctx.params

      const multipleChoiceSet = await this.multipleChoiceService.getMultipleChoiceSet(userId, setId)

      return ctx.response.ok({
        message: 'Multiple choice set retrieved successfully',
        data: multipleChoiceSet,
      })
    } catch (error) {
      if (error.message === 'Multiple choice set not found or access denied') {
        return ctx.response.notFound({
          message: 'Multiple choice set not found or you do not have access to it',
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve multiple choice set',
        error: error.message,
      })
    }
  }

  /**
   * Update a multiple choice set's name
   */
  async updateProjectMultipleChoiceSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { setId } = ctx.params
      const payload = await ctx.request.validateUsing(
        MultipleChoiceController.updateMultipleChoiceSetValidator
      )

      const updatedMultipleChoiceSet = await this.multipleChoiceService.updateMultipleChoiceSet(
        userId,
        setId,
        payload
      )

      return ctx.response.ok({
        message: 'Multiple choice set updated successfully',
        data: updatedMultipleChoiceSet,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (error.message === 'Multiple choice set not found or access denied') {
        return ctx.response.notFound({
          message: 'Multiple choice set not found or you do not have access to it',
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to update multiple choice set',
        error: error.message,
      })
    }
  }

  /**
   * Delete a multiple choice set and all its questions (CASCADE)
   */
  async deleteProjectMultipleChoiceSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { setId } = ctx.params

      await this.multipleChoiceService.deleteMultipleChoiceSet(userId, setId)

      return ctx.response.ok({
        message: 'Multiple choice set deleted successfully',
      })
    } catch (error) {
      if (error.message === 'Multiple choice set not found or access denied') {
        return ctx.response.notFound({
          message: 'Multiple choice set not found or you do not have access to it',
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to delete multiple choice set',
        error: error.message,
      })
    }
  }

  // ==========================================
  // Starred Questions (Quick Review)
  // ==========================================

  /**
   * Get all starred multiple choice questions for a project
   */
  async getProjectStarredMultipleChoiceQuestions(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId } = ctx.params

      const project = await verifyProjectOwnership(userId, projectId)

      // Load starred multiple choice questions with their set information
      await project.load('starredMultipleChoiceQuestions', (query) => {
        query.preload('multipleChoiceSet')
      })

      return ctx.response.ok({
        message: 'Starred multiple choice questions retrieved successfully',
        data: project.starredMultipleChoiceQuestions,
      })
    } catch (error) {
      return ctx.response.notFound({ message: error.message })
    }
  }

  /**
   * Star a multiple choice question for quick review
   */
  async starMultipleChoiceQuestion(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId, questionId } = ctx.params

      const project = await verifyProjectOwnership(userId, projectId)

      // Verify question exists and belongs to a multiple choice set in this project
      const question = await MultipleChoiceQuestion.query()
        .where('id', questionId)
        .preload('multipleChoiceSet', (query) => {
          query.where('project_id', projectId)
        })
        .first()

      if (!question || !question.multipleChoiceSet) {
        return ctx.response.notFound({
          message: 'Multiple choice question not found or does not belong to this project',
        })
      }

      // Add to starred questions (attach will ignore duplicates)
      await project.related('starredMultipleChoiceQuestions').attach([questionId])

      return ctx.response.ok({
        message: 'Multiple choice question starred successfully',
      })
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to star multiple choice question',
        error: error.message,
      })
    }
  }

  /**
   * Unstar a multiple choice question
   */
  async unstarMultipleChoiceQuestion(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId, questionId } = ctx.params

      const project = await verifyProjectOwnership(userId, projectId)

      // Remove from starred questions
      await project.related('starredMultipleChoiceQuestions').detach([questionId])

      return ctx.response.ok({
        message: 'Multiple choice question unstarred successfully',
      })
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to unstar multiple choice question',
        error: error.message,
      })
    }
  }
}
