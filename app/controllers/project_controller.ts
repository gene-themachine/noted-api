/**
 * Project Controller
 *
 * Manages projects (the top-level organizational unit):
 * 1. Project CRUD - Create, read, update, delete projects
 * 2. Project Data - Get notes, library items, study tools for a project
 * 3. Tree Manipulation - Move/reorder notes and folders via drag-and-drop
 *
 * Projects contain:
 * - Notes organized in folder tree (stored as JSON in folderStructure)
 * - Library items (PDFs, documents)
 * - Study tools (flashcards, quizzes, free response)
 * - Starred items for quick review
 *
 * Tree Structure:
 * - Stored as hierarchical JSON in project.folderStructure
 * - Supports drag-and-drop reordering via moveNode/reorderNodes
 * - Manipulated by @dnd-kit on frontend
 *
 * Related Controllers:
 * - NotesController handles note/folder creation
 * - StudyToolsControllers manage study materials
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { errors as vineErrors } from '@vinejs/vine'
import ProjectService from '#services/project_service'
import { isNotFoundError } from './helpers.js'

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

  // ==========================================
  // Project CRUD
  // ==========================================

  /**
   * Create a new project
   */
  async createNewProject(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const payload = await ctx.request.validateUsing(ProjectController.createValidator)

      const project = await this.projectService.createProject({
        name: payload.name,
        description: payload.description || null,
        color: payload.color || null,
        userId,
      })

      return ctx.response.created({
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
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to create project',
      })
    }
  }

  /**
   * Get all projects for the authenticated user
   */
  async getUserProjects(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projects = await this.projectService.getUserProjects(userId)

      return ctx.response.ok({
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
      return ctx.response.internalServerError({
        message: 'Failed to retrieve projects',
      })
    }
  }

  /**
   * Get a single project by ID with all relations
   */
  async getProjectById(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const project = await this.projectService.getProjectWithRelations(userId, ctx.params.id)

      return ctx.response.ok({
        project,
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Project not found' })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve project',
      })
    }
  }

  /**
   * Update project details (name, description, color)
   */
  async updateProject(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projectId = ctx.params.id
      const payload = await ctx.request.validateUsing(ProjectController.updateValidator)

      const project = await this.projectService.updateProject(userId, projectId, payload)

      return ctx.response.ok({
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
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Project not found' })
      }

      return ctx.response.internalServerError({
        message: 'Failed to update project',
        error: error.message,
      })
    }
  }

  /**
   * Delete a project and all associated data (CASCADE)
   */
  async deleteProject(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projectId = ctx.params.id

      await this.projectService.deleteProject(userId, projectId)

      return ctx.response.ok({
        message: 'Project deleted successfully',
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Project not found' })
      }

      return ctx.response.internalServerError({
        message: 'Failed to delete project',
        error: error.message,
      })
    }
  }

  // ==========================================
  // Project Data Retrieval
  // ==========================================

  /**
   * Get all notes for a specific project (with full content)
   */
  async getProjectNotes(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projectId = ctx.params.id

      // Verify user has access to the project
      await this.projectService.getProjectById(userId, projectId)

      const notes = await this.projectService.getProjectNotes(userId, projectId)

      return ctx.response.ok({
        message: 'Project notes retrieved successfully',
        data: {
          notes,
        },
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Project not found' })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve project notes',
        error: error.message,
      })
    }
  }

  /**
   * Get note summaries for a specific project (lightweight - no content)
   * Used for lists and performance-sensitive views
   */
  async getProjectNotesSummary(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projectId = ctx.params.id

      await this.projectService.getProjectById(userId, projectId)

      const notesSummary = await this.projectService.getProjectNotesSummary(userId, projectId)

      return ctx.response.ok({
        message: 'Project notes summary retrieved successfully',
        data: {
          notes: notesSummary,
        },
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Project not found' })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve project notes summary',
      })
    }
  }

  /**
   * Get optimized data for tools screen
   * Returns summary counts and basic info for study tools
   */
  async getProjectToolsData(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projectId = ctx.params.id

      const toolsData = await this.projectService.getProjectToolsData(userId, projectId)

      return ctx.response.ok({
        message: 'Project tools data retrieved successfully',
        data: toolsData,
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Project not found' })
      }
      return ctx.response.internalServerError({
        message: 'Failed to retrieve project tools data',
        error: error.message,
      })
    }
  }

  // ==========================================
  // Tree Manipulation (Drag-and-Drop)
  // ==========================================

  /**
   * Move a node (note or folder) to a different location in the tree
   *
   * Used for drag-and-drop operations:
   * - Move note to different folder
   * - Move folder to different parent
   * - Reposition items within tree hierarchy
   */
  async moveNode(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projectId = ctx.params.id
      const payload = await ctx.request.validateUsing(ProjectController.moveNodeValidator)

      await this.projectService.moveNode(
        userId,
        projectId,
        payload.nodeId,
        payload.newParentId,
        payload.newIndex
      )

      return ctx.response.ok({
        message: 'Node moved successfully',
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Project not found' })
      }

      if (error.message.includes('Failed to move')) {
        return ctx.response.badRequest({
          message: error.message,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to move node',
        error: error.message,
      })
    }
  }

  /**
   * Reorder children within a parent node
   *
   * Used for drag-and-drop reordering:
   * - Reorder notes within a folder
   * - Reorder folders within a parent
   * - Maintain custom sort order
   */
  async reorderNodes(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const projectId = ctx.params.id
      const payload = await ctx.request.validateUsing(ProjectController.reorderNodesValidator)

      await this.projectService.reorderNodes(userId, projectId, payload.parentId, payload.childIds)

      return ctx.response.ok({
        message: 'Nodes reordered successfully',
      })
    } catch (error) {
      if (error instanceof vineErrors.E_VALIDATION_ERROR) {
        return ctx.response.badRequest({
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      if (isNotFoundError(error)) {
        return ctx.response.notFound({ message: 'Project not found' })
      }

      if (error.message.includes('Failed to reorder')) {
        return ctx.response.badRequest({
          message: error.message,
        })
      }

      return ctx.response.internalServerError({
        message: 'Failed to reorder nodes',
        error: error.message,
      })
    }
  }
}
