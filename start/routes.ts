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
const FlashcardController = () => import('#controllers/flashcard_controller')

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
    router.delete('/projects/:projectId/folders/:folderId', [NotesController, 'deleteFolder'])
    router.get('/projects/:projectId/tree', [NotesController, 'getProjectTree'])

    // Study options routes
    router.get('/notes/:noteId/study-options', [NotesController, 'getStudyOptions'])
    router.put('/notes/:noteId/study-options', [NotesController, 'updateStudyOptions'])
    router.get('/study-options', [NotesController, 'getAvailableStudyOptions'])

    // New routes for note-library item association
    router.post('/notes/:noteId/library-items/:libraryItemId', [
      NotesController,
      'addLibraryItemToNote',
    ])
    router.delete('/notes/:noteId/library-items/:libraryItemId', [
      NotesController,
      'removeLibraryItemFromNote',
    ])

    // Flashcard routes
    router.post('/flashcards/create', [FlashcardController, 'createFlashcards'])
    router.get('/notes/:noteId/flashcards', [FlashcardController, 'getFlashcardsByNote'])
    router.put('/notes/:noteId/flashcards/mark-needs-update', [
      FlashcardController,
      'markFlashcardsAsNeedingUpdate',
    ])

    // Flashcard-Library relationship routes
    router.post('/flashcards/:flashcardId/library-items/:libraryItemId', [
      FlashcardController,
      'addLibraryItemToFlashcard',
    ])
    router.delete('/flashcards/:flashcardId/library-items/:libraryItemId', [
      FlashcardController,
      'removeLibraryItemFromFlashcard',
    ])

    // Libraries routes
    router.post('/libraries/presigned-url', [LibrariesController, 'getPresignedUrl'])
    router.post('/libraries/upload', [LibrariesController, 'uploadFile'])
    router.get('/libraries', [LibrariesController, 'getAllLibraryItems'])
    router.get('/libraries/projects/:projectId', [LibrariesController, 'getProjectLibraryItems'])
    router.get('/libraries/:id/view', [LibrariesController, 'getLibraryItemViewUrl'])
    router.put('/libraries/:id/toggle-global', [LibrariesController, 'toggleGlobalStatus'])
  })
  .use(middleware.auth())

// Basic route
router.get('/', async () => {
  return { status: 'ok' }
})
