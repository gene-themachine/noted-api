import router from '@adonisjs/core/services/router'

const NotesController = () => import('#controllers/notes_controller')

/**
 * Notes routes - handles note CRUD operations, folders, and study options
 * All routes require authentication via middleware
 */
export default function registerNotesRoutes() {
  // Note CRUD operations
  router.post('/notes', [NotesController, 'createNote'])
  router.get('/notes/:noteId', [NotesController, 'getNoteById'])
  router.put('/notes/:noteId', [NotesController, 'updateNote'])
  router.delete('/notes/:noteId', [NotesController, 'deleteNote'])

  // Folder operations
  router.post('/folders', [NotesController, 'createFolder'])
  router.delete('/projects/:projectId/folders/:folderId', [NotesController, 'deleteFolder'])
  router.get('/projects/:projectId/tree', [NotesController, 'getProjectTree'])

  // Study options
  router.get('/notes/:noteId/study-options', [NotesController, 'getStudyOptions'])
  router.put('/notes/:noteId/study-options', [NotesController, 'updateStudyOptions'])
  router.get('/study-options', [NotesController, 'getAvailableStudyOptions'])

  // Library item attachment to notes
  router.post('/notes/:noteId/library-items/:libraryItemId', [
    NotesController,
    'addLibraryItemToNote',
  ])
  router.delete('/notes/:noteId/library-items/:libraryItemId', [
    NotesController,
    'removeLibraryItemFromNote',
  ])
}
