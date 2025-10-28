import router from '@adonisjs/core/services/router'

const FreeResponseController = () => import('#controllers/studyTools/free_response_controller')

/**
 * Free Response routes - handles free response question sets and AI evaluations
 * All routes require authentication via middleware
 */
export default function registerFreeResponseRoutes() {
  // Project-level free response set operations
  router.get('/projects/:projectId/study-sets/free-response', [
    FreeResponseController,
    'getProjectFreeResponseSets',
  ])
  router.post('/projects/:projectId/study-sets/free-response', [
    FreeResponseController,
    'createProjectFreeResponseSet',
  ])

  // Individual free response set operations
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

  // AI evaluation of user responses
  router.post('/free-response/:questionId/evaluate', [
    FreeResponseController,
    'evaluateUserResponse',
  ])
  router.get('/free-response/:questionId/evaluations', [
    FreeResponseController,
    'getEvaluationHistory',
  ])
}
