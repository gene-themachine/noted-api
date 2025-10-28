import router from '@adonisjs/core/services/router'

const MultipleChoiceController = () => import('#controllers/studyTools/multiple_choice_controller')

/**
 * Multiple Choice routes - handles multiple choice question sets and starred collections
 * All routes require authentication via middleware
 */
export default function registerMultipleChoiceRoutes() {
  // Project-level multiple choice set operations
  router.get('/projects/:projectId/study-sets/multiple-choice', [
    MultipleChoiceController,
    'getProjectMultipleChoiceSets',
  ])
  router.post('/projects/:projectId/study-sets/multiple-choice', [
    MultipleChoiceController,
    'createProjectMultipleChoiceSet',
  ])

  // Individual multiple choice set operations
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

  // Starred multiple choice questions collection
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
}
