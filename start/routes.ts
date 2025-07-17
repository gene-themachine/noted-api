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
const LibrariesController = () => import('#controllers/libraries_controller')

import { documentProcessingQueue } from '#controllers/libraries_controller'

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
    router.get('/projects/:id', [ProjectController, 'getProjectById'])

    // Notes routes
    router.get('/notes/:noteId', [NotesController, 'getNoteById'])
    router.put('/notes/:noteId', [NotesController, 'updateNote'])
    router.delete('/notes/:noteId', [NotesController, 'deleteNote'])
    router.post('/notes', [NotesController, 'createNote'])
    router.post('/folders', [NotesController, 'createFolder'])
    router.get('/projects/:projectId/tree', [NotesController, 'getProjectTree'])

    // Libraries routes
    router.post('/libraries/presigned-url', [LibrariesController, 'getPresignedUrl'])
    router.post('/libraries/upload', [LibrariesController, 'uploadFile'])
    router.get('/libraries', [LibrariesController, 'getAllLibraryItems'])
  })
  .use(middleware.auth())

// Basic route
router.get('/', async () => {
  try {
    const client = await documentProcessingQueue.client
    if (client.status === 'ready') {
      return {
        status: 'ok',
        message: '✅ BullMQ successfully connected to Redis.',
      }
    } else {
      return {
        status: 'connecting',
        message: `⏳ Redis connection status: ${client.status}`,
      }
    }
  } catch (error) {
    return {
      status: 'error',
      message: '❌ Could not connect to Redis.',
      error: error.message,
    }
  }
})
