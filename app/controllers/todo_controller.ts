import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import TodoService from '#services/todo_service'

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
  async index({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const todos = await this.todoService.getUserTodos(user.id)

      return response.ok({
        success: true,
        data: todos,
      })
    } catch (error) {
      console.error('❌ Error fetching todos:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch todos',
      })
    }
  }

  /**
   * Create a new todo
   */
  async store({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const payload = await request.validateUsing(TodoController.createValidator)

      const todo = await this.todoService.createTodo({
        title: payload.title,
        dueDate: payload.dueDate,
        userId: user.id,
      })

      return response.created({
        success: true,
        data: todo,
        message: 'Todo created successfully',
      })
    } catch (error) {
      console.error('❌ Error creating todo:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to create todo',
      })
    }
  }

  /**
   * Get a specific todo by ID
   */
  async show({ params, request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { id } = params

      const todo = await this.todoService.getTodoById(id, user.id)

      return response.ok({
        success: true,
        data: todo,
      })
    } catch (error) {
      console.error('❌ Error fetching todo:', error)
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Todo not found',
        })
      }
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch todo',
      })
    }
  }

  /**
   * Update a todo
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { id } = params
      const payload = await request.validateUsing(TodoController.updateValidator)

      const todo = await this.todoService.updateTodo(id, payload, user.id)

      return response.ok({
        success: true,
        data: todo,
        message: 'Todo updated successfully',
      })
    } catch (error) {
      console.error('❌ Error updating todo:', error)
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Todo not found',
        })
      }
      return response.internalServerError({
        success: false,
        message: 'Failed to update todo',
      })
    }
  }

  /**
   * Delete a todo
   */
  async destroy({ params, request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { id } = params

      await this.todoService.deleteTodo(id, user.id)

      return response.ok({
        success: true,
        message: 'Todo deleted successfully',
      })
    } catch (error) {
      console.error('❌ Error deleting todo:', error)
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Todo not found',
        })
      }
      return response.internalServerError({
        success: false,
        message: 'Failed to delete todo',
      })
    }
  }

  /**
   * Toggle todo completion status
   */
  async toggle({ params, request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { id } = params

      const todo = await this.todoService.toggleTodoComplete(id, user.id)

      return response.ok({
        success: true,
        data: todo,
        message: 'Todo status updated successfully',
      })
    } catch (error) {
      console.error('❌ Error toggling todo:', error)
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Todo not found',
        })
      }
      return response.internalServerError({
        success: false,
        message: 'Failed to update todo status',
      })
    }
  }
}
