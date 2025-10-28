/**
 * Todo Controller
 *
 * Manages user to-do items with standard CRUD operations:
 * - Create, read, update, delete todos
 * - Toggle completion status
 * - Due date tracking
 *
 * Simple controller with no complex relationships.
 * Todos are user-scoped (not project-scoped).
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import TodoService from '#services/todo_service'
import { isNotFoundError } from './helpers.js'

export default class TodoController {
  private todoService: TodoService

  constructor() {
    this.todoService = new TodoService()
  }

  static createValidator = vine.compile(
    vine.object({
      title: vine.string().trim().minLength(1).maxLength(255),
      dueDate: vine.string().trim().optional(),
    })
  )

  static updateValidator = vine.compile(
    vine.object({
      title: vine.string().trim().minLength(1).maxLength(255).optional(),
      dueDate: vine.string().trim().optional().nullable(),
      isCompleted: vine.boolean().optional(),
    })
  )

  /**
   * Get all todos for the authenticated user
   */
  async index(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const todos = await this.todoService.getUserTodos(userId)

      return ctx.response.ok({
        success: true,
        data: todos,
      })
    } catch (error) {
      console.error('❌ Error fetching todos:', error)
      return ctx.response.internalServerError({
        success: false,
        message: 'Failed to fetch todos',
      })
    }
  }

  /**
   * Create a new todo
   */
  async store(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const payload = await ctx.request.validateUsing(TodoController.createValidator)

      const todo = await this.todoService.createTodo({
        title: payload.title,
        dueDate: payload.dueDate,
        userId,
      })

      return ctx.response.created({
        success: true,
        data: todo,
        message: 'Todo created successfully',
      })
    } catch (error) {
      console.error('❌ Error creating todo:', error)
      return ctx.response.internalServerError({
        success: false,
        message: 'Failed to create todo',
      })
    }
  }

  /**
   * Get a specific todo by ID
   */
  async show(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { id } = ctx.params

      const todo = await this.todoService.getTodoById(id, userId)

      return ctx.response.ok({
        success: true,
        data: todo,
      })
    } catch (error) {
      console.error('❌ Error fetching todo:', error)
      if (isNotFoundError(error)) {
        return ctx.response.notFound({
          success: false,
          message: 'Todo not found',
        })
      }
      return ctx.response.internalServerError({
        success: false,
        message: 'Failed to fetch todo',
      })
    }
  }

  /**
   * Update a todo's title, due date, or completion status
   */
  async update(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { id } = ctx.params
      const payload = await ctx.request.validateUsing(TodoController.updateValidator)

      const todo = await this.todoService.updateTodo(id, payload, userId)

      return ctx.response.ok({
        success: true,
        data: todo,
        message: 'Todo updated successfully',
      })
    } catch (error) {
      console.error('❌ Error updating todo:', error)
      if (isNotFoundError(error)) {
        return ctx.response.notFound({
          success: false,
          message: 'Todo not found',
        })
      }
      return ctx.response.internalServerError({
        success: false,
        message: 'Failed to update todo',
      })
    }
  }

  /**
   * Delete a todo
   */
  async destroy(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { id } = ctx.params

      await this.todoService.deleteTodo(id, userId)

      return ctx.response.ok({
        success: true,
        message: 'Todo deleted successfully',
      })
    } catch (error) {
      console.error('❌ Error deleting todo:', error)
      if (isNotFoundError(error)) {
        return ctx.response.notFound({
          success: false,
          message: 'Todo not found',
        })
      }
      return ctx.response.internalServerError({
        success: false,
        message: 'Failed to delete todo',
      })
    }
  }

  /**
   * Toggle todo completion status (completed ↔ incomplete)
   */
  async toggle(ctx: HttpContext) {
    try {
      const userId = ctx.userId!
      const { id } = ctx.params

      const todo = await this.todoService.toggleTodoComplete(id, userId)

      return ctx.response.ok({
        success: true,
        data: todo,
        message: 'Todo status updated successfully',
      })
    } catch (error) {
      console.error('❌ Error toggling todo:', error)
      if (isNotFoundError(error)) {
        return ctx.response.notFound({
          success: false,
          message: 'Todo not found',
        })
      }
      return ctx.response.internalServerError({
        success: false,
        message: 'Failed to update todo status',
      })
    }
  }
}
