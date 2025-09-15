import type { HttpContext } from '@adonisjs/core/http'
import { NotificationService } from '#services/notification_service'
import AuthorizationService from '#services/authorization_service'

export default class NotificationsController {
  private notificationService = new NotificationService()
  private authorizationService = new AuthorizationService()

  /**
   * Get notifications for a specific project
   */
  async getProjectNotifications({ request, response, params }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { projectId } = params
      const { limit = 50 } = request.qs()

      // Check if user has access to the project
      await this.authorizationService.getProjectForUser(user.id, projectId)

      const notifications = await this.notificationService.getProjectNotifications(
        projectId,
        Number.parseInt(limit)
      )

      return response.ok({
        data: notifications.map((n) => n.serialize()),
      })
    } catch (error) {
      console.error('Error fetching project notifications:', error)
      return response.internalServerError({
        error: 'Failed to fetch notifications',
      })
    }
  }

  /**
   * Get notifications for the authenticated user
   */
  async getUserNotifications({ request, response }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { limit = 50 } = request.qs()

      const notifications = await this.notificationService.getUserNotifications(
        user.id,
        Number.parseInt(limit)
      )

      return response.ok({
        data: notifications.map((n) => n.serialize()),
      })
    } catch (error) {
      console.error('Error fetching user notifications:', error)
      return response.internalServerError({
        error: 'Failed to fetch notifications',
      })
    }
  }

  /**
   * Delete a specific notification
   */
  async deleteNotification({ request, response, params }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { notificationId } = params

      // Get notification to check ownership
      const notifications = await this.notificationService.getUserNotifications(user.id, 1000)
      const notification = notifications.find((n) => n.id === notificationId)

      if (!notification) {
        return response.notFound({
          error: 'Notification not found',
        })
      }

      await this.notificationService.deleteNotification(notificationId)

      return response.ok({
        message: 'Notification deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting notification:', error)
      return response.internalServerError({
        error: 'Failed to delete notification',
      })
    }
  }

  /**
   * Clear all completed notifications for a project
   */
  async clearCompletedNotifications({ request, response, params }: HttpContext) {
    try {
      const user = (request as any)?.user || { id: (request as any)?.userId }
      const { projectId } = params

      // Check if user has access to the project
      await this.authorizationService.getProjectForUser(user.id, projectId)

      const deletedCount = await this.notificationService.clearCompletedNotifications(projectId)

      return response.ok({
        message: `Cleared ${deletedCount} completed notifications`,
        deletedCount,
      })
    } catch (error) {
      console.error('Error clearing completed notifications:', error)
      return response.internalServerError({
        error: 'Failed to clear notifications',
      })
    }
  }
}
