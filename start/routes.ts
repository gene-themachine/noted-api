/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
const AuthController = () => import('#controllers/auth_controller')
const ProjectController = () => import('#controllers/project_controller')
const NotesController = () => import('#controllers/notes_controller')

// Public routes (no authentication required)
router.post('/auth/register', [AuthController, 'register'])
router.post('/auth/login', [AuthController, 'login'])

// Protected routes (authentication required)
router
  .group(() => {
    router.post('/auth/logout', [AuthController, 'logout'])
    router.get('/auth/me', [AuthController, 'me'])

    // Project/Group routes
    router.post('/projects', [ProjectController, 'createNewProject'])
    router.get('/projects', [ProjectController, 'getUserProjects'])

    // Notes routes
    router.post('/notes', [NotesController, 'createNote'])
    router.post('/folders', [NotesController, 'createFolder'])
    router.get('/projects/:projectId/tree', [NotesController, 'getProjectTree'])
  })
  .use(middleware.auth())

// Basic route
router.get('/', async () => {
  return {
    hello: 'world',
  }
})
