import router from '@adonisjs/core/services/router'

const ProjectController = () => import('#controllers/project_controller')

/**
 * Project routes - handles project CRUD operations and tree management
 * All routes require authentication via middleware
 */
export default function registerProjectRoutes() {
  // Project CRUD operations
  router.post('/projects', [ProjectController, 'createNewProject'])
  router.get('/projects', [ProjectController, 'getUserProjects'])
  router.get('/projects/:id', [ProjectController, 'getProjectById'])
  router.put('/projects/:id', [ProjectController, 'updateProject'])
  router.delete('/projects/:id', [ProjectController, 'deleteProject'])

  // Project tree management (folder structure)
  router.put('/projects/:id/tree/move', [ProjectController, 'moveNode'])
  router.put('/projects/:id/tree/reorder', [ProjectController, 'reorderNodes'])

  // Project-related data retrieval
  router.get('/projects/:id/notes', [ProjectController, 'getProjectNotes'])
  router.get('/projects/:id/notes/summary', [ProjectController, 'getProjectNotesSummary'])
  router.get('/projects/:id/tools-data', [ProjectController, 'getProjectToolsData'])
}
