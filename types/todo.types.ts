/**
 * Todo Types
 * Types related to todo items
 */

import { DateTime } from 'luxon'

export interface CreateTodoData {
  title: string
  dueDate?: DateTime | string
  userId: string
}

export interface UpdateTodoData {
  title?: string
  dueDate?: DateTime | string | null
  isCompleted?: boolean
}
