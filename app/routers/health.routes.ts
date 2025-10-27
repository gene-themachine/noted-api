import router from '@adonisjs/core/services/router'

/**
 * Health check routes - public endpoints that don't require authentication
 */
export default function registerHealthRoutes() {
  router.get('/', async () => {
    return { status: 'ok' }
  })
}
