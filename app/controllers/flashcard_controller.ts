import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import FlashcardSet from '#models/flashcard_set'
import Note from '#models/note'
import LibraryItem from '#models/library_item'
import Project from '#models/project'
import Flashcard from '#models/flashcard'
import { FlashcardService } from '#services/flashcard_service'
import AIService from '#services/ai_service'

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

  // Project-level flashcard set methods
  async getProjectFlashcardSets({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { projectId } = params

      const flashcardSets = await this.flashcardService.getProjectFlashcardSets(user.id, projectId)

      return response.ok({
        message: 'Flashcard sets retrieved successfully',
        data: flashcardSets,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve flashcard sets',
        error: error.message,
      })
    }
  }

  async createProjectFlashcardSet({ params, request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { projectId } = params
      const payload = await request.validateUsing(FlashcardController.createFlashcardSetValidator)

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

      // Create the flashcard set
      const flashcardSet = await FlashcardSet.create({
        name: payload.name,
        userId: user.id,
        projectId: projectId,
      })

      // Attach notes and library items
      if (selectedNotes.length > 0) {
        await flashcardSet.related('notes').attach(selectedNotes)
      }
      if (selectedLibraryItems.length > 0) {
        await flashcardSet.related('libraryItems').attach(selectedLibraryItems)
      }

      // Generate flashcards directly
      console.log('Starting flashcard generation:', {
        flashcardSetId: flashcardSet.id,
        userId: user.id,
        projectId: projectId,
        notesCount: selectedNotes.length,
        libraryItemsCount: selectedLibraryItems.length,
      })

      try {
        const result = await this.aiService.generateFlashcardSet({
          flashcardSetId: flashcardSet.id,
          userId: user.id,
          projectId: projectId,
          selectedNoteIds: selectedNotes,
          selectedLibraryItemIds: selectedLibraryItems,
        })

        console.log('✅ Flashcard generation completed successfully')

        return response.created({
          ...flashcardSet.serialize(),
          type: 'flashcard',
          message: `Flashcard set created successfully with ${result.flashcardsCount} flashcards`,
          status: 'completed',
          flashcardsCount: result.flashcardsCount,
        })
      } catch (generationError) {
        console.error('❌ Failed to generate flashcards:', generationError)
        // Delete the created set if generation failed
        await flashcardSet.delete()
        throw new Error(`Failed to generate flashcards: ${generationError.message}`)
      }
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to create flashcard set',
        error: error.message,
      })
    }
  }

  async getFlashcardSet({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { setId } = params

      const flashcardSet = await this.flashcardService.getFlashcardSet(user.id, setId)

      return response.ok({
        message: 'Flashcard set retrieved successfully',
        data: flashcardSet,
      })
    } catch (error) {
      if (error.message === 'Flashcard set not found or access denied') {
        return response.notFound({
          message: 'Flashcard set not found or you do not have access to it',
        })
      }
      return response.internalServerError({
        message: 'Failed to retrieve flashcard set',
        error: error.message,
      })
    }
  }

  async updateProjectFlashcardSet({ params, request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { setId } = params
      const payload = await request.validateUsing(FlashcardController.updateFlashcardSetValidator)

      const updatedFlashcardSet = await this.flashcardService.updateFlashcardSet(
        user.id,
        setId,
        payload
      )

      return response.ok({
        message: 'Flashcard set updated successfully',
        data: updatedFlashcardSet,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (error.message === 'Flashcard set not found or access denied') {
        return response.notFound({
          message: 'Flashcard set not found or you do not have access to it',
        })
      }

      return response.internalServerError({
        message: 'Failed to update flashcard set',
        error: error.message,
      })
    }
  }

  async deleteFlashcardSet({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { setId } = params

      await this.flashcardService.deleteFlashcardSet(user.id, setId)

      return response.ok({
        message: 'Flashcard set deleted successfully',
      })
    } catch (error) {
      if (error.message === 'Flashcard set not found or access denied') {
        return response.notFound({
          message: 'Flashcard set not found or you do not have access to it',
        })
      }
      return response.internalServerError({
        message: 'Failed to delete flashcard set',
        error: error.message,
      })
    }
  }

  async markFlashcardsAsNeedingUpdate({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { noteId } = params

      await this.flashcardService.markFlashcardsAsNeedingUpdate(user.id, noteId)

      return response.ok({
        message: 'Flashcards marked as needing update successfully',
      })
    } catch (error) {
      if (error.message === 'Note not found or access denied') {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }
      return response.internalServerError({
        message: 'Failed to mark flashcards as needing update',
        error: error.message,
      })
    }
  }

  // Retrieve starred flashcards methods
  async getProjectStarredFlashcards({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { projectId } = params

      // Verify user owns the project
      const project = await Project.query().where('id', projectId).where('user_id', user.id).first()

      if (!project) {
        return response.notFound({
          message: 'Project not found or you do not have access to it',
        })
      }

      // Load starred flashcards with their flashcard set information
      await project.load('starredFlashcards', (query) => {
        query.preload('flashcardSet')
      })

      return response.ok({
        message: 'Starred flashcards retrieved successfully',
        data: project.starredFlashcards,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve starred flashcards',
        error: error.message,
      })
    }
  }

  // Star a flashcard // unstar a flashcard methods
  async starFlashcard({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { projectId, flashcardId } = params

      // Verify user owns the project
      const project = await Project.query().where('id', projectId).where('user_id', user.id).first()

      if (!project) {
        return response.notFound({
          message: 'Project not found or you do not have access to it',
        })
      }

      // Verify flashcard exists and belongs to a flashcard set in this project
      const flashcard = await Flashcard.query()
        .where('id', flashcardId)
        .preload('flashcardSet', (query) => {
          query.where('project_id', projectId)
        })
        .first()

      if (!flashcard || !flashcard.flashcardSet) {
        return response.notFound({
          message: 'Flashcard not found or does not belong to this project',
        })
      }

      // Add to starred flashcards (attach will ignore duplicates)
      await project.related('starredFlashcards').attach([flashcardId])

      return response.ok({
        message: 'Flashcard starred successfully',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to star flashcard',
        error: error.message,
      })
    }
  }

  async unstarFlashcard({ params, response, request }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { projectId, flashcardId } = params

      // Verify user owns the project
      const project = await Project.query().where('id', projectId).where('user_id', user.id).first()

      if (!project) {
        return response.notFound({
          message: 'Project not found or you do not have access to it',
        })
      }

      // Remove from starred flashcards
      await project.related('starredFlashcards').detach([flashcardId])

      return response.ok({
        message: 'Flashcard unstarred successfully',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to unstar flashcard',
        error: error.message,
      })
    }
  }
}
