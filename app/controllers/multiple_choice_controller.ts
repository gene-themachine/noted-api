import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import MultipleChoiceSet from '#models/multiple_choice_set'
import Note from '#models/note'
import LibraryItem from '#models/library_item'
import { MultipleChoiceService } from '#services/multiple_choice_service'
import AIService from '#services/ai_service'

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

  // Project-level multiple choice set methods
  async getProjectMultipleChoiceSets({ params, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const { projectId } = params

      const multipleChoiceSets = await this.multipleChoiceService.getProjectMultipleChoiceSets(
        user.id,
        projectId
      )

      return response.ok({
        message: 'Multiple choice sets retrieved successfully',
        data: multipleChoiceSets.map((set) => ({
          ...set.serialize(),
          type: 'multiple_choice',
        })),
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve multiple choice sets',
        error: error.message,
      })
    }
  }

  async createProjectMultipleChoiceSet({ params, request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const { projectId } = params
      const payload = await request.validateUsing(
        MultipleChoiceController.createProjectMultipleChoiceSetValidator
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

      // Create the multiple choice set
      const multipleChoiceSet = await MultipleChoiceSet.create({
        name: payload.name,
        userId: user.id,
        projectId: projectId,
      })

      // Attach notes and library items
      if (selectedNotes.length > 0) {
        await multipleChoiceSet.related('notes').attach(selectedNotes)
      }
      if (selectedLibraryItems.length > 0) {
        await multipleChoiceSet.related('libraryItems').attach(selectedLibraryItems)
      }

      // Generate multiple choice questions directly
      console.log('Starting multiple choice generation:', {
        multipleChoiceSetId: multipleChoiceSet.id,
        userId: user.id,
        projectId: projectId,
        notesCount: selectedNotes.length,
        libraryItemsCount: selectedLibraryItems.length,
      })

      try {
        const result = await this.aiService.generateMultipleChoiceSet({
          multipleChoiceSetId: multipleChoiceSet.id,
          userId: user.id,
          projectId: projectId,
          selectedNoteIds: selectedNotes,
          selectedLibraryItemIds: selectedLibraryItems,
        })

        console.log('✅ Multiple choice generation completed successfully')

        return response.created({
          ...multipleChoiceSet.serialize(),
          type: 'multiple_choice',
          message: `Multiple choice set created successfully with ${result.questionsCount} questions`,
          status: 'completed',
          questionsCount: result.questionsCount,
        })
      } catch (generationError) {
        console.error('❌ Failed to generate multiple choice questions:', generationError)
        // Delete the created set if generation failed
        await multipleChoiceSet.delete()
        throw new Error(`Failed to generate multiple choice questions: ${generationError.message}`)
      }
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to create multiple choice set',
        error: error.message,
      })
    }
  }

  async getProjectMultipleChoiceSet({ params, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const { setId } = params

      const multipleChoiceSet = await this.multipleChoiceService.getMultipleChoiceSet(
        user.id,
        setId
      )

      return response.ok({
        message: 'Multiple choice set retrieved successfully',
        data: multipleChoiceSet,
      })
    } catch (error) {
      if (error.message === 'Multiple choice set not found or access denied') {
        return response.notFound({
          message: 'Multiple choice set not found or you do not have access to it',
        })
      }
      return response.internalServerError({
        message: 'Failed to retrieve multiple choice set',
        error: error.message,
      })
    }
  }

  async deleteProjectMultipleChoiceSet({ params, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const { setId } = params

      await this.multipleChoiceService.deleteMultipleChoiceSet(user.id, setId)

      return response.ok({
        message: 'Multiple choice set deleted successfully',
      })
    } catch (error) {
      if (error.message === 'Multiple choice set not found or access denied') {
        return response.notFound({
          message: 'Multiple choice set not found or you do not have access to it',
        })
      }
      return response.internalServerError({
        message: 'Failed to delete multiple choice set',
        error: error.message,
      })
    }
  }
}
