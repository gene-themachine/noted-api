import type { HttpContext } from '@adonisjs/core/http'
import Project from '#models/project'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'

export default class ProjectController {
  static createValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1).maxLength(255),
      description: vine.string().trim().optional(),
    })
  )

  // Create a new project/group
  async createNewProject({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const payload = await request.validateUsing(ProjectController.createValidator)

      const project = await Project.create({
        name: payload.name,
        description: payload.description || null,
        userId: user.id,
      })

      return response.created({
        message: 'Project created successfully',
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          userId: project.userId,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        message: 'Failed to create project',
      })
    }
  }

  // Get all projects for the authenticated user
  async getUserProjects({ response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()

      const projects = await Project.query()
        .where('userId', user.id)
        .whereNull('deletedAt')
        .orderBy('createdAt', 'desc')

      return response.ok({
        message: 'Projects retrieved successfully',
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          userId: project.userId,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        })),
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve projects',
      })
    }
  }
}
