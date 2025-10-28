/**
 * Free Response Controller
 *
 * Manages free response question sets with AI-powered generation and evaluation:
 * 1. User selects notes/library items as source material
 * 2. AI generates open-ended questions requiring written responses
 * 3. User submits text answers
 * 4. AI evaluates answers and provides feedback (score + explanation)
 * 5. Evaluation history tracked for progress monitoring
 *
 * Unique Feature: AI Evaluation
 * - Unlike flashcards/multiple choice, free response requires AI grading
 * - Each submission is evaluated for correctness and completeness
 * - Feedback helps users understand what they missed
 * - History allows tracking improvement over time
 *
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import FreeResponseSet from '#models/free_response_set'
import { FreeResponseService } from '#services/studyTools/free_response_service'
import AIService from '#services/ai_service'
import { validateContentSources } from './helpers.js'

export default class FreeResponseController {
  private freeResponseService = new FreeResponseService()
  private aiService = new AIService()

  static createProjectFreeResponseSetValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1),
      selectedNotes: vine.array(vine.string()).optional(),
      selectedLibraryItems: vine.array(vine.string()).optional(),
    })
  )

  static updateFreeResponseSetValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1),
    })
  )

  static evaluateResponseValidator = vine.compile(
    vine.object({
      userAnswer: vine.string().trim().minLength(1),
    })
  )

  // ==========================================
  // CRUD Operations for Free Response Sets
  // ==========================================

  /**
   * Get all free response sets for a project
   */
  async getProjectFreeResponseSets(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId } = ctx.params

      const freeResponseSets = await this.freeResponseService.getProjectFreeResponseSets(
        userId,
        projectId
      )

      return ctx.response.ok({
        message: 'Free response sets retrieved successfully',
        data: freeResponseSets.map((set) => ({
          ...set.serialize(),
          type: 'free_response',
        })),
      })
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to retrieve free response sets',
        error: error.message,
      })
    }
  }

  /**
   * Create a new free response set with AI generation
   *
   * Process:
   * 1. Validate input and content sources
   * 2. Create free response set record
   * 3. Attach source notes/library items
   * 4. Generate open-ended questions using AI
   * 5. If generation fails, rollback the set creation
   */
  async createProjectFreeResponseSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { projectId } = ctx.params
      const payload = await ctx.request.validateUsing(
        FreeResponseController.createProjectFreeResponseSetValidator
      )

      const selectedNotes = payload.selectedNotes || []
      const selectedLibraryItems = payload.selectedLibraryItems || []

      // Validate content sources
      try {
        await validateContentSources(selectedNotes, selectedLibraryItems, userId, projectId)
      } catch (validationError) {
        return ctx.response.badRequest({ message: validationError.message })
      }

      // Create the free response set
      const freeResponseSet = await FreeResponseSet.create({
        name: payload.name,
        userId,
        projectId,
      })

      // Attach source content
      if (selectedNotes.length > 0) {
        await freeResponseSet.related('notes').attach(selectedNotes)
      }
      if (selectedLibraryItems.length > 0) {
        await freeResponseSet.related('libraryItems').attach(selectedLibraryItems)
      }

      // Generate free response questions using AI
      console.log('Starting free response generation:', {
        freeResponseSetId: freeResponseSet.id,
        userId,
        projectId,
        notesCount: selectedNotes.length,
        libraryItemsCount: selectedLibraryItems.length,
      })

      try {
        const result = await this.aiService.generateFreeResponseSet({
          freeResponseSetId: freeResponseSet.id,
          userId,
          projectId,
          selectedNoteIds: selectedNotes,
          selectedLibraryItemIds: selectedLibraryItems,
        })

        console.log('✅ Free response generation completed successfully')

        return ctx.response.created({
          ...freeResponseSet.serialize(),
          type: 'free_response',
          message: `Free response set created successfully with ${result.questionsCount} questions`,
          status: 'completed',
          questionsCount: result.questionsCount,
        })
      } catch (generationError) {
        console.error('❌ Failed to generate free response questions:', generationError)
        // Rollback: Delete the created set if generation failed
        await freeResponseSet.delete()
        throw new Error(`Failed to generate free response questions: ${generationError.message}`)
      }
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to create free response set',
        error: error.message,
      })
    }
  }

  /**
   * Get a specific free response set with all its questions
   */
  async getProjectFreeResponseSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { setId } = ctx.params

      const freeResponseSet = await this.freeResponseService.getFreeResponseSet(userId, setId)

      return ctx.response.ok({
        message: 'Free response set retrieved successfully',
        data: freeResponseSet,
      })
    } catch (error) {
      if (error.message === 'Free response set not found or access denied') {
        return ctx.response.notFound({
          message: 'Free response set not found or you do not have access to it',
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve free response set',
        error: error.message,
      })
    }
  }

  /**
   * Update a free response set's name
   */
  async updateProjectFreeResponseSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { setId } = ctx.params
      const payload = await ctx.request.validateUsing(
        FreeResponseController.updateFreeResponseSetValidator
      )

      const updatedFreeResponseSet = await this.freeResponseService.updateFreeResponseSet(
        userId,
        setId,
        payload
      )

      return ctx.response.ok({
        message: 'Free response set updated successfully',
        data: updatedFreeResponseSet,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (error.message === 'Free response set not found or access denied') {
        return ctx.response.notFound({
          message: 'Free response set not found or you do not have access to it',
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to update free response set',
        error: error.message,
      })
    }
  }

  /**
   * Delete a free response set and all its questions (CASCADE)
   */
  async deleteProjectFreeResponseSet(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { setId } = ctx.params

      await this.freeResponseService.deleteFreeResponseSet(userId, setId)

      return ctx.response.ok({
        message: 'Free response set deleted successfully',
      })
    } catch (error) {
      if (error.message === 'Free response set not found or access denied') {
        return ctx.response.notFound({
          message: 'Free response set not found or you do not have access to it',
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to delete free response set',
        error: error.message,
      })
    }
  }

  // ==========================================
  // AI Evaluation of User Responses
  // ==========================================

  /**
   * Evaluate a user's answer to a free response question
   *
   * Process:
   * 1. Retrieve the question and expected answer
   * 2. Use AI to grade the user's response
   * 3. AI provides score (0-100) and detailed feedback
   * 4. Save evaluation to database for history tracking
   *
   * Returns:
   * - score: 0-100 numeric grade
   * - feedback: AI-generated explanation of what was good/missing
   * - timestamp: When evaluation was performed
   */
  async evaluateUserResponse(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { questionId } = ctx.params
      const payload = await ctx.request.validateUsing(
        FreeResponseController.evaluateResponseValidator
      )

      const evaluation = await this.freeResponseService.evaluateUserResponse(
        userId,
        questionId,
        payload.userAnswer
      )

      console.log(
        '🔍 Evaluation data being returned:',
        JSON.stringify(evaluation.serialize(), null, 2)
      )

      return ctx.response.ok({
        message: 'Response evaluated successfully',
        data: evaluation.serialize(),
      })
    } catch (error) {
      if (
        error.message === 'Free response question not found' ||
        error.message === 'Access denied to this free response set'
      ) {
        return ctx.response.notFound({
          message: error.message,
        })
      }
      return ctx.response.internalServerError({
        message: 'Failed to evaluate response',
        error: error.message,
      })
    }
  }

  /**
   * Get evaluation history for a specific question
   *
   * Shows all previous attempts by the user, allowing them to:
   * - Track improvement over time
   * - Review past feedback
   * - See how their understanding has evolved
   */
  async getEvaluationHistory(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { questionId } = ctx.params

      const evaluations = await this.freeResponseService.getEvaluationHistory(userId, questionId)

      return ctx.response.ok({
        message: 'Evaluation history retrieved successfully',
        data: evaluations,
      })
    } catch (error) {
      return ctx.response.internalServerError({
        message: 'Failed to retrieve evaluation history',
        error: error.message,
      })
    }
  }
}
