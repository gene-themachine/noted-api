import router from '@adonisjs/core/services/router'

const TodoController = () => import('#controllers/todo_controller')

/**
 * Todo routes - handles basic todo CRUD operations
 * All routes require authentication via middleware
 */
export default function registerTodoRoutes() {
  router.get('/todos', [TodoController, 'index'])
  router.post('/todos', [TodoController, 'store'])
  router.get('/todos/:id', [TodoController, 'show'])
  router.put('/todos/:id', [TodoController, 'update'])
  router.delete('/todos/:id', [TodoController, 'destroy'])
  router.patch('/todos/:id/toggle', [TodoController, 'toggle'])
}
