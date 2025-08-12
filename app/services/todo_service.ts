import Todo from '#models/todo'
import { DateTime } from 'luxon'

interface CreateTodoData {
  title: string
  dueDate?: DateTime | string
  userId: string
}

interface UpdateTodoData {
  title?: string
  dueDate?: DateTime | string | null
  isCompleted?: boolean
}

export default class TodoService {
  constructor() {
    // Service initialization
  }

  /**
   * Get all todos for a user
   */
  async getUserTodos(userId: string): Promise<Todo[]> {
    const todos = await Todo.query()
      .where('userId', userId)
      .orderBy('isCompleted', 'asc')
      .orderBy('dueDate', 'asc')
      .orderBy('createdAt', 'desc')

    return todos
  }

  /**
   * Create a new todo
   */
  async createTodo(data: CreateTodoData): Promise<Todo> {
    const { title, dueDate, userId } = data

    const todoData: Partial<Todo> = {
      title,
      userId,
      isCompleted: false,
    }

    // Handle due date conversion
    if (dueDate) {
      if (typeof dueDate === 'string') {
        todoData.dueDate = DateTime.fromISO(dueDate)
      } else {
        todoData.dueDate = dueDate
      }
    }

    const todo = await Todo.create(todoData)
    return todo
  }

  /**
   * Update a todo
   */
  async updateTodo(todoId: string, data: UpdateTodoData, userId: string): Promise<Todo> {
    const todo = await Todo.query().where('id', todoId).where('userId', userId).firstOrFail()

    const updateData: Partial<Todo> = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.isCompleted !== undefined) updateData.isCompleted = data.isCompleted

    // Handle due date conversion
    if (data.dueDate !== undefined) {
      if (data.dueDate === null) {
        updateData.dueDate = null
      } else if (typeof data.dueDate === 'string') {
        updateData.dueDate = DateTime.fromISO(data.dueDate)
      } else {
        updateData.dueDate = data.dueDate
      }
    }

    todo.merge(updateData)
    await todo.save()

    return todo
  }

  /**
   * Delete a todo
   */
  async deleteTodo(todoId: string, userId: string): Promise<void> {
    const todo = await Todo.query().where('id', todoId).where('userId', userId).firstOrFail()
    await todo.delete()
  }

  /**
   * Toggle todo completion status
   */
  async toggleTodoComplete(todoId: string, userId: string): Promise<Todo> {
    const todo = await Todo.query().where('id', todoId).where('userId', userId).firstOrFail()

    todo.isCompleted = !todo.isCompleted
    await todo.save()

    return todo
  }

  /**
   * Get a specific todo by ID
   */
  async getTodoById(todoId: string, userId: string): Promise<Todo> {
    const todo = await Todo.query().where('id', todoId).where('userId', userId).firstOrFail()
    return todo
  }
}
