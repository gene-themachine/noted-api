import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import Flashcard from '#models/flashcard'
import Note from '#models/note'
import { randomUUID } from 'node:crypto'

export default class FlashcardController {
  static createFlashcardsValidator = vine.compile(
    vine.object({
      noteId: vine.string().trim().minLength(1),
      selectedLibraryItems: vine.array(vine.string()).optional(),
      includeNoteContent: vine.boolean(),
    })
  )

  async createFlashcards({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const payload = await request.validateUsing(FlashcardController.createFlashcardsValidator)

      // Verify that the note exists and belongs to the user
      const note = await Note.query().where('id', payload.noteId).where('user_id', user.id).first()

      if (!note) {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }

      // Create 10 hardcoded flashcards for now
      const hardcodedFlashcards = [
        {
          term: 'Machine Learning',
          definition:
            'A subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed.',
        },
        {
          term: 'Neural Network',
          definition:
            'A computing system inspired by biological neural networks, consisting of interconnected nodes that process information.',
        },
        {
          term: 'Algorithm',
          definition:
            'A step-by-step procedure or formula for solving a problem or completing a task.',
        },
        {
          term: 'Data Structure',
          definition:
            'A way of organizing and storing data in a computer so that it can be accessed and modified efficiently.',
        },
        {
          term: 'API',
          definition:
            'Application Programming Interface - a set of protocols and tools for building software applications.',
        },
        {
          term: 'Database',
          definition:
            'An organized collection of structured information, or data, typically stored electronically in a computer system.',
        },
        {
          term: 'Cloud Computing',
          definition:
            'The delivery of computing services over the internet, including servers, storage, databases, and software.',
        },
        {
          term: 'Encryption',
          definition:
            'The process of converting information into a secret code to prevent unauthorized access.',
        },
        {
          term: 'Framework',
          definition:
            'A platform for developing software applications that provides a foundation of pre-written code.',
        },
        {
          term: 'Version Control',
          definition:
            'A system that records changes to files over time so you can recall specific versions later.',
        },
      ]

      const createdFlashcards = []

      for (const flashcardData of hardcodedFlashcards) {
        const flashcard = await Flashcard.create({
          id: randomUUID(),
          noteId: payload.noteId,
          userId: user.id,
          projectId: note.projectId!,
          term: flashcardData.term,
          definition: flashcardData.definition,
          usingNoteContent: payload.includeNoteContent,
          needsUpdate: false, // Initially false when created
        })

        // Associate selected library items with this flashcard
        if (payload.selectedLibraryItems && payload.selectedLibraryItems.length > 0) {
          const libraryItemAttachments: {
            [key: string]: { created_at: string; updated_at: string }
          } = {}
          const now = new Date().toISOString()

          payload.selectedLibraryItems.forEach((itemId) => {
            libraryItemAttachments[itemId] = {
              created_at: now,
              updated_at: now,
            }
          })

          await flashcard.related('libraryItems').attach(libraryItemAttachments)
        }

        createdFlashcards.push(flashcard)
      }

      return response.created({
        message: 'Flashcards created successfully',
        flashcards: createdFlashcards,
        count: createdFlashcards.length,
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to create flashcards',
        error: error.message,
      })
    }
  }

  async getFlashcardsByNote({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const noteId = request.param('noteId')

      // Verify that the note exists and belongs to the user
      const note = await Note.query().where('id', noteId).where('user_id', user.id).first()

      if (!note) {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }

      const flashcards = await Flashcard.query()
        .where('note_id', noteId)
        .preload('libraryItems')
        .orderBy('created_at', 'desc')

      return response.ok({
        message: 'Flashcards retrieved successfully',
        flashcards,
        count: flashcards.length,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve flashcards',
        error: error.message,
      })
    }
  }

  async markFlashcardsAsNeedingUpdate({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const noteId = request.param('noteId')

      // Verify that the note exists and belongs to the user
      const note = await Note.query().where('id', noteId).where('user_id', user.id).first()

      if (!note) {
        return response.notFound({
          message: 'Note not found or you do not have access to it',
        })
      }

      // Update all flashcards for this note that use note content
      const updatedFlashcards = await Flashcard.query()
        .where('note_id', noteId)
        .where('using_note_content', true)
        .update({ needsUpdate: true })

      return response.ok({
        message: 'Flashcards marked as needing update',
        updatedCount: updatedFlashcards[0] || 0,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to mark flashcards as needing update',
        error: error.message,
      })
    }
  }

  async addLibraryItemToFlashcard({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const flashcardId = request.param('flashcardId')
      const libraryItemId = request.param('libraryItemId')

      // Verify that the flashcard exists and belongs to the user
      const flashcard = await Flashcard.query()
        .where('id', flashcardId)
        .where('user_id', user.id)
        .first()

      if (!flashcard) {
        return response.notFound({
          message: 'Flashcard not found or you do not have access to it',
        })
      }

      // Verify library item exists and user has access
      const LibraryItemModule = await import('#models/library_item')
      const LibraryItem = LibraryItemModule.default
      const libraryItem = await LibraryItem.query().where('id', libraryItemId).first()

      if (!libraryItem) {
        return response.notFound({
          message: 'Library item not found',
        })
      }

      // Attach the library item to the flashcard with timestamps
      await flashcard.related('libraryItems').attach({
        [libraryItemId]: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })

      return response.ok({
        message: 'Library item added to flashcard successfully',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to add library item to flashcard',
        error: error.message,
      })
    }
  }

  async removeLibraryItemFromFlashcard({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const flashcardId = request.param('flashcardId')
      const libraryItemId = request.param('libraryItemId')

      // Verify that the flashcard exists and belongs to the user
      const flashcard = await Flashcard.query()
        .where('id', flashcardId)
        .where('user_id', user.id)
        .first()

      if (!flashcard) {
        return response.notFound({
          message: 'Flashcard not found or you do not have access to it',
        })
      }

      // Detach the library item from the flashcard
      await flashcard.related('libraryItems').detach([libraryItemId])

      return response.ok({
        message: 'Library item removed from flashcard successfully',
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to remove library item from flashcard',
        error: error.message,
      })
    }
  }
}
