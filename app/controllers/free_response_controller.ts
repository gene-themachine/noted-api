import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import FreeResponseSet from '#models/free_response_set'
import Note from '#models/note'
import LibraryItem from '#models/library_item'
import { FreeResponseService } from '#services/free_response_service'
import AIService from '#services/ai_service'

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

  // Project-level free response set methods
  async getProjectFreeResponseSets({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { projectId } = params

      const freeResponseSets = await this.freeResponseService.getProjectFreeResponseSets(
        user.id,
        projectId
      )

      return response.ok({
        message: 'Free response sets retrieved successfully',
        data: freeResponseSets.map((set) => ({
          ...set.serialize(),
          type: 'free_response',
        })),
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve free response sets',
        error: error.message,
      })
    }
  }

  async createProjectFreeResponseSet({ params, request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { projectId } = params
      const payload = await request.validateUsing(
        FreeResponseController.createProjectFreeResponseSetValidator
      )

      const selectedNotes = payload.selectedNotes || []
      const selectedLibraryItems = payload.selectedLibraryItems || []

      // Ensure at least one content source is selected
      if (selectedNotes.length === 0 && selectedLibraryItems.length === 0) {
        return response.badRequest({
          message: 'At least one note or library item must be selected',
        })
      }

      // Verify all selected notes belong to the user and project (if any)
      if (selectedNotes.length > 0) {
        const notes = await Note.query()
          .whereIn('id', selectedNotes)
          .where('user_id', user.id)
          .where('project_id', projectId)

        if (notes.length !== selectedNotes.length) {
          return response.badRequest({
            message: 'Some selected notes are invalid or do not belong to this project',
          })
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
          return response.badRequest({
            message: 'Some selected library items are invalid or not accessible',
          })
        }
      }

      // Create the free response set
      const freeResponseSet = await FreeResponseSet.create({
        name: payload.name,
        userId: user.id,
        projectId: projectId,
      })

      // Attach notes and library items
      if (selectedNotes.length > 0) {
        await freeResponseSet.related('notes').attach(selectedNotes)
      }
      if (selectedLibraryItems.length > 0) {
        await freeResponseSet.related('libraryItems').attach(selectedLibraryItems)
      }

      // Generate free response questions directly
      console.log('Starting free response generation:', {
        freeResponseSetId: freeResponseSet.id,
        userId: user.id,
        projectId: projectId,
        notesCount: selectedNotes.length,
        libraryItemsCount: selectedLibraryItems.length,
      })

      try {
        const result = await this.aiService.generateFreeResponseSet({
          freeResponseSetId: freeResponseSet.id,
          userId: user.id,
          projectId: projectId,
          selectedNoteIds: selectedNotes,
          selectedLibraryItemIds: selectedLibraryItems,
        })

        console.log('✅ Free response generation completed successfully')

        return response.created({
          ...freeResponseSet.serialize(),
          type: 'free_response',
          message: `Free response set created successfully with ${result.questionsCount} questions`,
          status: 'completed',
          questionsCount: result.questionsCount,
        })
      } catch (generationError) {
        console.error('❌ Failed to generate free response questions:', generationError)
        // Delete the created set if generation failed
        await freeResponseSet.delete()
        throw new Error(`Failed to generate free response questions: ${generationError.message}`)
      }
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to create free response set',
        error: error.message,
      })
    }
  }

  async getProjectFreeResponseSet({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { setId } = params

      const freeResponseSet = await this.freeResponseService.getFreeResponseSet(user.id, setId)

      return response.ok({
        message: 'Free response set retrieved successfully',
        data: freeResponseSet,
      })
    } catch (error) {
      if (error.message === 'Free response set not found or access denied') {
        return response.notFound({
          message: 'Free response set not found or you do not have access to it',
        })
      }
      return response.internalServerError({
        message: 'Failed to retrieve free response set',
        error: error.message,
      })
    }
  }

  async updateProjectFreeResponseSet({ params, request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { setId } = params
      const payload = await request.validateUsing(
        FreeResponseController.updateFreeResponseSetValidator
      )

      const updatedFreeResponseSet = await this.freeResponseService.updateFreeResponseSet(
        user.id,
        setId,
        payload
      )

      return response.ok({
        message: 'Free response set updated successfully',
        data: updatedFreeResponseSet,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (error.message === 'Free response set not found or access denied') {
        return response.notFound({
          message: 'Free response set not found or you do not have access to it',
        })
      }

      return response.internalServerError({
        message: 'Failed to update free response set',
        error: error.message,
      })
    }
  }

  async deleteProjectFreeResponseSet({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { setId } = params

      await this.freeResponseService.deleteFreeResponseSet(user.id, setId)

      return response.ok({
        message: 'Free response set deleted successfully',
      })
    } catch (error) {
      if (error.message === 'Free response set not found or access denied') {
        return response.notFound({
          message: 'Free response set not found or you do not have access to it',
        })
      }
      return response.internalServerError({
        message: 'Failed to delete free response set',
        error: error.message,
      })
    }
  }

  async evaluateUserResponse({ params, request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { questionId } = params
      const payload = await request.validateUsing(FreeResponseController.evaluateResponseValidator)

      const evaluation = await this.freeResponseService.evaluateUserResponse(
        user.id,
        questionId,
        payload.userAnswer
      )

      console.log(
        '🔍 Evaluation data being returned:',
        JSON.stringify(evaluation.serialize(), null, 2)
      )

      return response.ok({
        message: 'Response evaluated successfully',
        data: evaluation.serialize(),
      })
    } catch (error) {
      if (
        error.message === 'Free response question not found' ||
        error.message === 'Access denied to this free response set'
      ) {
        return response.notFound({
          message: error.message,
        })
      }
      return response.internalServerError({
        message: 'Failed to evaluate response',
        error: error.message,
      })
    }
  }

  async getEvaluationHistory({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { questionId } = params

      const evaluations = await this.freeResponseService.getEvaluationHistory(user.id, questionId)

      return response.ok({
        message: 'Evaluation history retrieved successfully',
        data: evaluations,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve evaluation history',
        error: error.message,
      })
    }
  }
}
