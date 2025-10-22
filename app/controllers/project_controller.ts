import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import ProjectService from '#services/project_service'

export default class ProjectController {
  private projectService: ProjectService

  constructor() {
    this.projectService = new ProjectService()
  }

  static createValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1).maxLength(255),
      description: vine.string().trim().optional(),
      color: vine
        .string()
        .trim()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    })
  )

  static updateValidator = vine.compile(
    vine.object({
      name: vine.string().trim().minLength(1).maxLength(255).optional(),
      description: vine.string().trim().optional(),
      color: vine
        .string()
        .trim()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    })
  )

  static moveNodeValidator = vine.compile(
    vine.object({
      nodeId: vine.string().trim().minLength(1),
      newParentId: vine.string().trim().minLength(1),
      newIndex: vine.number().min(0),
    })
  )

  static reorderNodesValidator = vine.compile(
    vine.object({
      parentId: vine.string().trim().minLength(1),
      childIds: vine.array(vine.string().trim().minLength(1)),
    })
  )

  // Create a new project/group
  async createNewProject({ request, response }: HttpContext) {
    try {
      const userId =
        (request as any)?.user?.id || (request as any)?.userId || (global as any)?.userId
      const payload = await request.validateUsing(ProjectController.createValidator)

      const project = await this.projectService.createProject({
        name: payload.name,
        description: payload.description || null,
        color: payload.color || null,
        userId,
      })

      return response.created({
        message: 'Project created successfully',
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          color: project.color,
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
  async getUserProjects({ response, request }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId
      const projects = await this.projectService.getUserProjects(userId)

      return response.ok({
        message: 'Projects retrieved successfully',
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          color: project.color,
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

  async getProjectById({ response, params, request }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId
      const project = await this.projectService.getProjectWithRelations(userId, params.id)

      return response.ok({
        project,
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Project not found' })
      }
      return response.internalServerError({
        message: 'Failed to retrieve project',
      })
    }
  }

  /**
   * Get all notes for a specific project
   */
  async getProjectNotes({ response, params, request }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId
      const projectId = params.id

      // First verify user has access to the project
      await this.projectService.getProjectById(userId, projectId)

      // Get notes for this project
      const notes = await this.projectService.getProjectNotes(userId, projectId)

      return response.ok({
        message: 'Project notes retrieved successfully',
        data: {
          notes: notes,
        },
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Project not found' })
      }
      return response.internalServerError({
        message: 'Failed to retrieve project notes',
        error: error.message,
      })
    }
  }

  /**
   * Get note summaries for a specific project (lightweight - no content)
   */
  async getProjectNotesSummary({ response, params, request }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId
      const projectId = params.id
      // First verify user has access to the project
      await this.projectService.getProjectById(userId, projectId)
      // Get note summaries for this project
      const notesSummary = await this.projectService.getProjectNotesSummary(userId, projectId)
      return response.ok({
        message: 'Project notes summary retrieved successfully',
        data: {
          notes: notesSummary,
        },
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Project not found' })
      }
      return response.internalServerError({
        message: 'Failed to retrieve project notes summary',
      })
    }
  }

  /**
   * Get optimized data for tools screen - only summary counts and basic info
   */
  async getProjectToolsData({ response, params, request }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId
      const projectId = params.id

      const toolsData = await this.projectService.getProjectToolsData(userId, projectId)

      return response.ok({
        message: 'Project tools data retrieved successfully',
        data: toolsData,
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Project not found' })
      }
      return response.internalServerError({
        message: 'Failed to retrieve project tools data',
        error: error.message,
      })
    }
  }

  /**
   * Update project details (name, description, color)
   */
  async updateProject({ request, response, params }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId
      const projectId = params.id
      const payload = await request.validateUsing(ProjectController.updateValidator)

      const project = await this.projectService.updateProject(userId, projectId, payload)

      return response.ok({
        message: 'Project updated successfully',
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          color: project.color,
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

      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Project not found' })
      }

      return response.internalServerError({
        message: 'Failed to update project',
        error: error.message,
      })
    }
  }

  /**
   * Delete a project and all associated data
   */
  async deleteProject({ request, response, params }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId
      const projectId = params.id

      await this.projectService.deleteProject(userId, projectId)

      return response.ok({
        message: 'Project deleted successfully',
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Project not found' })
      }

      return response.internalServerError({
        message: 'Failed to delete project',
        error: error.message,
      })
    }
  }

  /**
   * Move a node to a different location in the tree
   */
  async moveNode({ request, response, params }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId
      const projectId = params.id
      const payload = await request.validateUsing(ProjectController.moveNodeValidator)

      await this.projectService.moveNode(
        userId,
        projectId,
        payload.nodeId,
        payload.newParentId,
        payload.newIndex
      )

      return response.ok({
        message: 'Node moved successfully',
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Project not found' })
      }

      if (error.message.includes('Failed to move')) {
        return response.badRequest({
          message: error.message,
        })
      }

      return response.internalServerError({
        message: 'Failed to move node',
        error: error.message,
      })
    }
  }

  /**
   * Reorder children within a parent node
   */
  async reorderNodes({ request, response, params }: HttpContext) {
    try {
      const userId = (request as any)?.user?.id || (request as any)?.userId
      const projectId = params.id
      const payload = await request.validateUsing(ProjectController.reorderNodesValidator)

      await this.projectService.reorderNodes(userId, projectId, payload.parentId, payload.childIds)

      return response.ok({
        message: 'Nodes reordered successfully',
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (error.message.includes('not found')) {
        return response.notFound({ message: 'Project not found' })
      }

      if (error.message.includes('Failed to reorder')) {
        return response.badRequest({
          message: error.message,
        })
      }

      return response.internalServerError({
        message: 'Failed to reorder nodes',
        error: error.message,
      })
    }
  }

  // SSE functionality removed - using static notifications only
}
