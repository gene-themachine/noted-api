import type { HttpContext } from '@adonisjs/core/http'
import LibraryItem from '#models/library_item'
import Project from '#models/project'
import vine from '@vinejs/vine'
import { randomUUID } from 'node:crypto'
import { getPresignedUrl, getPresignedViewUrl } from '../utils/s3.js'
import { DateTime } from 'luxon'

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
      isGlobal: vine.boolean().optional(),
    })
  )

  async getPresignedUrl({ request, response, auth }: HttpContext) {
    await auth.authenticate()
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
      isGlobal: payload.isGlobal || false,
      uploadedAt: DateTime.now(),
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

  async getProjectLibraryItems({ request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const projectId = request.param('projectId')

    await Project.query().where('id', projectId).where('user_id', user.id).firstOrFail()

    const libraryItems = await LibraryItem.query()
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')

    return response.json(libraryItems)
  }

  async getLibraryItemViewUrl({ request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const libraryItemId = request.param('id')

    const libraryItem = await LibraryItem.findOrFail(libraryItemId)
    await Project.query().where('id', libraryItem.projectId).where('user_id', user.id).firstOrFail()

    const { presignedUrl } = await getPresignedViewUrl(libraryItem.storagePath)

    return response.json({ url: presignedUrl })
  }

  async toggleGlobalStatus({ request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const libraryItemId = request.param('id')

    const libraryItem = await LibraryItem.findOrFail(libraryItemId)
    await Project.query().where('id', libraryItem.projectId).where('user_id', user.id).firstOrFail()

    libraryItem.isGlobal = !libraryItem.isGlobal
    await libraryItem.save()

    return response.ok(libraryItem)
  }
}
