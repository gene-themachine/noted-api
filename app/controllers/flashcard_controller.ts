import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import Flashcard from '#models/flashcard'
import Note from '#models/note'
import StudyOptions from '#models/study_options'
import { Queue } from 'bullmq'
import queueConfig from '#config/queue'

// Define the shape of the job data
interface QueueJob {
  noteId: string
  userId: string
  projectId: string
  includeNoteContent: boolean
  selectedLibraryItemIds: string[]
}

// The queue name MUST match the name the microservice worker is listening to
const flashcardQueue = new Queue('flashcard generation', {
  connection: queueConfig.connections.redis,
})

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

      // Check if flashcards already exist for this note
      const existingFlashcards = await Flashcard.query().where('note_id', payload.noteId)
      if (existingFlashcards.length > 0) {
        return response.badRequest({
          message: 'Flashcards already exist for this note. Delete existing flashcards first.',
        })
      }

      // Validate that we have some content to work with
      const hasNoteContent = payload.includeNoteContent && note.content.trim().length > 0
      const hasLibraryItems =
        payload.selectedLibraryItems && payload.selectedLibraryItems.length > 0

      if (!hasNoteContent && !hasLibraryItems) {
        return response.badRequest({
          message: 'Please select note content or library items to generate flashcards from.',
        })
      }

      // Update study options to indicate flashcard generation is queued
      const studyOptions = await StudyOptions.query().where('note_id', payload.noteId).first()
      if (studyOptions) {
        await studyOptions.merge({ flashcard: 'queued' }).save()
      }

      // Prepare job data for the microservice
      // The microservice will:
      // 1. Fetch note data from Supabase using noteId (if includeNoteContent=true)
      // 2. Fetch library items from Supabase using selectedLibraryItemIds
      // 3. Download and analyze files using their storage paths
      // 4. Generate flashcards from the combined content
      // 5. Save flashcards to database and update study options status
      const jobData: QueueJob = {
        noteId: payload.noteId,
        userId: user.id,
        projectId: note.projectId!,
        includeNoteContent: payload.includeNoteContent,
        selectedLibraryItemIds: payload.selectedLibraryItems || [],
      }

      console.log('Queueing flashcard generation job:', {
        noteId: jobData.noteId,
        userId: jobData.userId,
        projectId: jobData.projectId,
        includeNoteContent: jobData.includeNoteContent,
        libraryItemsCount: jobData.selectedLibraryItemIds.length,
      })

      // Queue the flashcard generation job
      try {
        console.log('📤 Adding job to queue:', flashcardQueue.name)
        console.log('📤 Queue config:', queueConfig.connections.redis)

        const job = await flashcardQueue.add('generate-flashcards', jobData, {
          attempts: 3, // Retry up to 3 times on failure
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500, // Keep last 500 failed jobs
        })

        console.log('✅ Job added successfully:', {
          jobId: job.id,
          jobName: job.name,
          queueName: flashcardQueue.name,
        })

        return response.accepted({
          message: 'Flashcard generation has been queued',
          jobId: job.id,
          noteId: payload.noteId,
          status: 'queued',
          estimatedTime: '30-60 seconds', // Estimated processing time
        })
      } catch (queueError) {
        console.error('❌ Failed to add job to queue:', queueError)
        console.error('❌ Queue config being used:', queueConfig.connections.redis)

        // Reset study options on queue failure
        if (studyOptions) {
          await studyOptions.merge({ flashcard: 'failed' }).save()
        }

        throw new Error(`Failed to queue job: ${queueError.message}`)
      }
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      // If there's an error, reset the study options status
      try {
        const studyOptions = await StudyOptions.query()
          .where('note_id', request.body().noteId)
          .first()
        if (studyOptions) {
          await studyOptions.merge({ flashcard: 'failed' }).save()
        }
      } catch (resetError) {
        console.error('Failed to reset study options on error:', resetError)
      }

      return response.internalServerError({
        message: 'Failed to queue flashcard generation',
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

      // Also get the current study options status
      const studyOptions = await StudyOptions.query().where('note_id', noteId).first()

      return response.ok({
        message: 'Flashcards retrieved successfully',
        flashcards,
        count: flashcards.length,
        status: studyOptions?.flashcard || null,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve flashcards',
        error: error.message,
      })
    }
  }

  async getFlashcardGenerationStatus({ request, response, auth }: HttpContext) {
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

      // Get the current study options status
      const studyOptions = await StudyOptions.query().where('note_id', noteId).first()
      const flashcardStatus = studyOptions?.flashcard || null

      // Check if flashcards exist
      const flashcards = await Flashcard.query().where('note_id', noteId)
      const hasFlashcards = flashcards.length > 0

      return response.ok({
        noteId,
        status: flashcardStatus,
        hasFlashcards,
        flashcardCount: flashcards.length,
        message: this.getStatusMessage(flashcardStatus, hasFlashcards),
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve flashcard generation status',
        error: error.message,
      })
    }
  }

  async streamFlashcardStatus({ request, response, auth }: HttpContext) {
    try {
      const user = auth.getUserOrFail() // auth.authenticate() has already been called by the middleware
      const noteId = request.param('noteId')

      // Verify that the note exists and belongs to the user
      const note = await Note.query().where('id', noteId).where('user_id', user.id).first()

      if (!note) {
        response.response.writeHead(404, { 'Content-Type': 'application/json' })
        response.response.write(
          `data: ${JSON.stringify({ error: 'Note not found or you do not have access to it' })}\n\n`
        )
        response.response.end()
        return
      }

      // Set up SSE headers
      response.response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
      })

      // Send initial status
      const sendStatus = async () => {
        try {
          const studyOptions = await StudyOptions.query().where('note_id', noteId).first()
          const flashcardStatus = studyOptions?.flashcard || null

          const flashcards = await Flashcard.query().where('note_id', noteId)
          const hasFlashcards = flashcards.length > 0

          const statusData = {
            noteId,
            status: flashcardStatus,
            hasFlashcards,
            flashcardCount: flashcards.length,
            message: this.getStatusMessage(flashcardStatus, hasFlashcards),
            timestamp: new Date().toISOString(),
          }

          response.response.write(`data: ${JSON.stringify(statusData)}\n\n`)
          return flashcardStatus
        } catch (error) {
          console.error('Error sending status:', error)
          return null
        }
      }

      // Send initial status
      await sendStatus()

      // Keep streaming updates until status is final (completed or failed)
      const pollInterval = setInterval(async () => {
        const newStatus = await sendStatus()

        // Close the stream if status is final or error occurred
        if (newStatus === null || newStatus === 'completed' || newStatus === 'failed') {
          clearInterval(pollInterval)
          response.response.end()
        }
      }, 2000) // Poll every 2 seconds

      // Clean up on client disconnect
      request.request.on('close', () => {
        clearInterval(pollInterval)
        response.response.end()
      })

      request.request.on('error', () => {
        clearInterval(pollInterval)
        response.response.end()
      })
    } catch (error) {
      response.response.writeHead(500, { 'Content-Type': 'application/json' })
      response.response.write(
        `data: ${JSON.stringify({ error: 'Failed to stream status', message: error.message })}\n\n`
      )
      response.response.end()
    }
  }

  private getStatusMessage(status: string | null, hasFlashcards: boolean): string {
    if (status === 'queued') {
      return 'Flashcard generation is in progress...'
    } else if (status === 'completed' && hasFlashcards) {
      return 'Flashcards are ready for study'
    } else if (status === 'failed') {
      return 'Flashcard generation failed. You can try again.'
    } else if (hasFlashcards) {
      return 'Flashcards are available'
    } else {
      return 'No flashcards have been generated yet'
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
