import router from '@adonisjs/core/services/router'

const FlashcardController = () => import('#controllers/flashcard_controller')

/**
 * Flashcard routes - handles flashcard sets, individual flashcards, and starred collections
 * All routes require authentication via middleware
 */
export default function registerFlashcardRoutes() {
  // Mark flashcards as needing update when note content changes
  router.put('/notes/:noteId/flashcards/mark-needs-update', [
    FlashcardController,
    'markFlashcardsAsNeedingUpdate',
  ])

  // Project-level flashcard set operations
  router.get('/projects/:projectId/study-sets/flashcards', [
    FlashcardController,
    'getProjectFlashcardSets',
  ])
  router.post('/projects/:projectId/study-sets/flashcards', [
    FlashcardController,
    'createProjectFlashcardSet',
  ])

  // Individual flashcard set operations
  router.get('/study-sets/flashcards/:setId', [FlashcardController, 'getFlashcardSet'])
  router.put('/study-sets/flashcards/:setId', [FlashcardController, 'updateProjectFlashcardSet'])
  router.delete('/study-sets/flashcards/:setId', [FlashcardController, 'deleteFlashcardSet'])

  // Starred flashcards collection
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
}
