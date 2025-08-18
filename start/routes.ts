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
const MultipleChoiceController = () => import('#controllers/multiple_choice_controller')
const FreeResponseController = () => import('#controllers/free_response_controller')
const NotificationsController = () => import('#controllers/notifications_controller')
const QAController = () => import('#controllers/qa_controller')
const TodoController = () => import('#controllers/todo_controller')

// Public routes (no authentication required)
router.group(() => {
  router.post('/auth/register', [AuthController, 'register'])
  router.post('/auth/login', [AuthController, 'login'])
})

// Protected routes (authentication required)
router
  .group(() => {
    router.post('/auth/logout', [AuthController, 'logout'])
    router.get('/auth/me', [AuthController, 'me'])

    // Project/Group routes
    router.post('/projects', [ProjectController, 'createNewProject'])
    router.get('/projects', [ProjectController, 'getUserProjects'])
    router.get('/projects/:id', [ProjectController, 'getProjectById'])
    router.get('/projects/:id/notes', [ProjectController, 'getProjectNotes'])
    // Lightweight endpoint for note selection UI - returns only essential fields without content
    router.get('/projects/:id/notes/summary', [ProjectController, 'getProjectNotesSummary'])
    router.get('/projects/:id/tools-data', [ProjectController, 'getProjectToolsData'])

    // Notes routes
    router.get('/notes/:noteId', [NotesController, 'getNoteById'])
    router.put('/notes/:noteId', [NotesController, 'updateNote'])
    router.delete('/notes/:noteId', [NotesController, 'deleteNote'])
    router.post('/notes', [NotesController, 'createNote'])
    router.post('/folders', [NotesController, 'createFolder'])
    router.delete('/projects/:projectId/folders/:folderId', [NotesController, 'deleteFolder'])
    router.get('/projects/:projectId/tree', [NotesController, 'getProjectTree'])

    // Note flashcard routes
    router.put('/notes/:noteId/flashcards/mark-needs-update', [
      FlashcardController,
      'markFlashcardsAsNeedingUpdate',
    ])

    // Study options routes
    router.get('/notes/:noteId/study-options', [NotesController, 'getStudyOptions'])
    router.put('/notes/:noteId/study-options', [NotesController, 'updateStudyOptions'])
    router.get('/study-options', [NotesController, 'getAvailableStudyOptions'])

    // Q&A routes
    router.post('/notes/:noteId/qa/generate', [QAController, 'generate'])

    // New routes for not
    router.post('/notes/:noteId/library-items/:libraryItemId', [
      NotesController,
      'addLibraryItemToNote',
    ])
    router.delete('/notes/:noteId/library-items/:libraryItemId', [
      NotesController,
      'removeLibraryItemFromNote',
    ])

    // Project-level Flashcard Set routes
    router.get('/projects/:projectId/study-sets/flashcards', [
      FlashcardController,
      'getProjectFlashcardSets',
    ])
    router.post('/projects/:projectId/study-sets/flashcards', [
      FlashcardController,
      'createProjectFlashcardSet',
    ])
    router.get('/study-sets/flashcards/:setId', [FlashcardController, 'getFlashcardSet'])
    router.put('/study-sets/flashcards/:setId', [FlashcardController, 'updateProjectFlashcardSet'])
    router.delete('/study-sets/flashcards/:setId', [FlashcardController, 'deleteFlashcardSet'])

    // Starred flashcards routes
    router.get('/projects/:projectId/starred-flashcards', [
      FlashcardController,
      'getProjectStarredFlashcards',
    ])
    router.post('/projects/:projectId/flashcards/:flashcardId/star', [
      FlashcardController,
      'starFlashcard',
    ])
    router.delete('/projects/:projectId/flashcards/:flashcardId/star', [
      FlashcardController,
      'unstarFlashcard',
    ])

    // Starred multiple choice questions routes
    router.get('/projects/:projectId/starred-multiple-choice-questions', [
      MultipleChoiceController,
      'getProjectStarredMultipleChoiceQuestions',
    ])
    router.post('/projects/:projectId/multiple-choice-questions/:questionId/star', [
      MultipleChoiceController,
      'starMultipleChoiceQuestion',
    ])
    router.delete('/projects/:projectId/multiple-choice-questions/:questionId/star', [
      MultipleChoiceController,
      'unstarMultipleChoiceQuestion',
    ])

    // Project-level Multiple Choice Set routes
    router.get('/projects/:projectId/study-sets/multiple-choice', [
      MultipleChoiceController,
      'getProjectMultipleChoiceSets',
    ])
    router.post('/projects/:projectId/study-sets/multiple-choice', [
      MultipleChoiceController,
      'createProjectMultipleChoiceSet',
    ])
    router.get('/study-sets/multiple-choice/:setId', [
      MultipleChoiceController,
      'getProjectMultipleChoiceSet',
    ])
    router.put('/study-sets/multiple-choice/:setId', [
      MultipleChoiceController,
      'updateProjectMultipleChoiceSet',
    ])
    router.delete('/study-sets/multiple-choice/:setId', [
      MultipleChoiceController,
      'deleteProjectMultipleChoiceSet',
    ])

    // Project-level Free Response Set routes
    router.get('/projects/:projectId/study-sets/free-response', [
      FreeResponseController,
      'getProjectFreeResponseSets',
    ])
    router.post('/projects/:projectId/study-sets/free-response', [
      FreeResponseController,
      'createProjectFreeResponseSet',
    ])
    router.get('/study-sets/free-response/:setId', [
      FreeResponseController,
      'getProjectFreeResponseSet',
    ])
    router.put('/study-sets/free-response/:setId', [
      FreeResponseController,
      'updateProjectFreeResponseSet',
    ])
    router.delete('/study-sets/free-response/:setId', [
      FreeResponseController,
      'deleteProjectFreeResponseSet',
    ])

    // Free Response evaluation routes
    router.post('/free-response/:questionId/evaluate', [
      FreeResponseController,
      'evaluateUserResponse',
    ])
    router.get('/free-response/:questionId/evaluations', [
      FreeResponseController,
      'getEvaluationHistory',
    ])

    // Libraries routes
    router.post('/libraries/presigned-url', [LibrariesController, 'getPresignedUrl'])
    router.post('/libraries/upload', [LibrariesController, 'uploadFile'])
    router.get('/libraries', [LibrariesController, 'getAllLibraryItems'])
    router.get('/libraries/projects/:projectId', [LibrariesController, 'getProjectLibraryItems'])
    router.get('/libraries/:id', [LibrariesController, 'getLibraryItemById'])
    router.get('/libraries/:id/view', [LibrariesController, 'getLibraryItemViewUrl'])
    router.get('/libraries/:id/status', [LibrariesController, 'getLibraryItemStatus'])
    router.put('/libraries/:id/toggle-global', [LibrariesController, 'toggleGlobalStatus'])

    // Notification routes
    router.get('/projects/:projectId/notifications', [
      NotificationsController,
      'getProjectNotifications',
    ])
    router.get('/notifications', [NotificationsController, 'getUserNotifications'])
    router.delete('/notifications/:notificationId', [NotificationsController, 'deleteNotification'])
    router.delete('/projects/:projectId/notifications/completed', [
      NotificationsController,
      'clearCompletedNotifications',
    ])

    // Todo routes
    router.get('/todos', [TodoController, 'index'])
    router.post('/todos', [TodoController, 'store'])
    router.get('/todos/:id', [TodoController, 'show'])
    router.put('/todos/:id', [TodoController, 'update'])
    router.delete('/todos/:id', [TodoController, 'destroy'])
    router.patch('/todos/:id/toggle', [TodoController, 'toggle'])
  })
  .use(middleware.auth())

// SSE Q&A streaming endpoint (outside auth middleware to handle manual auth)
router.get('/notes/:noteId/qa/stream', [QAController, 'streamSSE'])

// Test endpoint for debugging Q&A streaming
router.get('/test/qa', [QAController, 'test'])

// SSE functionality removed - using static notifications only

// Basic route
router.get('/', async () => {
  return { status: 'ok' }
})
