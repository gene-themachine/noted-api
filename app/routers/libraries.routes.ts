import router from '@adonisjs/core/services/router'

const LibrariesController = () => import('#controllers/libraries_controller')

/**
 * Library routes - handles PDF/document uploads, S3 storage, and vectorization status
 * All routes require authentication via middleware
 */
export default function registerLibraryRoutes() {
  // File upload operations
  router.post('/libraries/presigned-url', [LibrariesController, 'getPresignedUrl'])
  router.post('/libraries/upload', [LibrariesController, 'uploadFile'])

  // Library item retrieval
  router.get('/libraries', [LibrariesController, 'getAllLibraryItems'])
  router.get('/libraries/projects/:projectId', [LibrariesController, 'getProjectLibraryItems'])
  router.get('/libraries/:id', [LibrariesController, 'getLibraryItemById'])

  // Library item operations
  router.get('/libraries/:id/view', [LibrariesController, 'getLibraryItemViewUrl'])
  router.get('/libraries/:id/status', [LibrariesController, 'getLibraryItemStatus'])
  router.put('/libraries/:id/toggle-global', [LibrariesController, 'toggleGlobalStatus'])
}
