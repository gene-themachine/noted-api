import type { HttpContext } from '@adonisjs/core/http'
import LibraryItem from '#models/library_item'
import Project from '#models/project'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import { randomUUID } from 'node:crypto'
import { getPresignedUrl } from '../utils/s3.js'
import { Queue } from 'bullmq'
import { DateTime } from 'luxon'

// Define the queue outside of the controller so it's a singleton.
export const documentProcessingQueue = new Queue('document-processing', {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
})

export default class LibrariesController {
  static presignedUrlValidator = vine.compile(
    vine.object({
      fileName: vine.string().trim().minLength(1).maxLength(255),
      fileType: vine.string().trim(),
    })
  )

  static uploadValidator = vine.compile(
    vine.object({
      projectId: vine.string().uuid(),
      key: vine.string(),
      fileName: vine.string(),
      fileType: vine.string(),
      size: vine.number().positive(),
    })
  )

  async getPresignedUrl({ request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const payload = await request.validateUsing(LibrariesController.presignedUrlValidator)

    const presignedUrl = await getPresignedUrl(payload.fileName, payload.fileType)

    return response.json({
      presignedUrl,
      key: presignedUrl.key,
      expiresIn: presignedUrl.expiresIn,
    })
  }

  async uploadFile({ request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const payload = await request.validateUsing(LibrariesController.uploadValidator)

    const project = await Project.query()
      .where('id', payload.projectId)
      .where('user_id', user.id)
      .firstOrFail()
    const randomId = randomUUID()

    const libraryItem = await LibraryItem.create({
      id: randomId,
      projectId: project.id,
      name: payload.fileName,
      mimeType: payload.fileType,
      storagePath: payload.key,
      size: payload.size,
      isGlobal: false,
      processingStatus: 'queued',
      uploadedAt: DateTime.now(),
    })

    // Enqueue job for processing
    await documentProcessingQueue.add('process-document', {
      id: randomId,
      libraryItemId: libraryItem.id,
      fileUrl: payload.key, // Or a full URL if you construct it
      userId: user.id,
    })

    return response.created(libraryItem)
  }

  async getAllLibraryItems({ response, auth }: HttpContext) {
    const user = await auth.authenticate()

    // 1. Get all project IDs belonging to the user
    const userProjects = await Project.query().where('user_id', user.id).select('id')
    const projectIds = userProjects.map((p) => p.id)

    if (projectIds.length === 0) {
      return response.json([])
    }

    // 2. Get all library items for those projects
    const libraryItems = await LibraryItem.query()
      .whereIn('project_id', projectIds)
      .orderBy('created_at', 'desc')

    return response.json(libraryItems)
  }
}
