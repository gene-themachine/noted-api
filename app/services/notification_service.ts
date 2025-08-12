import Notification from '#models/notification'

export class NotificationService {
  async createNotification(data: {
    userId: string
    projectId: string
    type: 'flashcard_generation' | 'multiple_choice_generation'
    title: string
    message: string
    studySetName: string
    studySetId?: string
  }): Promise<Notification> {
    const notification = await Notification.create({
      userId: data.userId,
      projectId: data.projectId,
      type: data.type,
      title: data.title,
      message: data.message,
      status: 'queued',
      progress: 0,
      studySetId: data.studySetId || null,
      studySetName: data.studySetName,
      errorMessage: null,
    })

    // Real-time updates disabled - using static notifications only

    return notification
  }

  async updateProgress(
    notificationId: string,
    progress: number,
    message?: string
  ): Promise<Notification> {
    const notification = await Notification.findOrFail(notificationId)

    notification.progress = Math.max(0, Math.min(100, progress))
    if (message) {
      notification.message = message
    }

    await notification.save()

    // Real-time updates disabled - using static notifications only

    return notification
  }

  async completeNotification(
    notificationId: string,
    studySetId: string,
    successMessage?: string
  ): Promise<Notification> {
    const notification = await Notification.findOrFail(notificationId)

    notification.status = 'completed'
    notification.progress = 100
    notification.studySetId = studySetId
    if (successMessage) {
      notification.message = successMessage
    }

    await notification.save()

    // Real-time updates disabled - using static notifications only

    return notification
  }

  async failNotification(notificationId: string, errorMessage: string): Promise<Notification> {
    const notification = await Notification.findOrFail(notificationId)

    notification.status = 'failed'
    notification.progress = 0
    notification.errorMessage = errorMessage
    notification.message = `Failed: ${errorMessage}`

    await notification.save()

    // Real-time updates disabled - using static notifications only

    return notification
  }

  async getProjectNotifications(projectId: string, limit: number = 50): Promise<Notification[]> {
    return await Notification.query()
      .where('project_id', projectId)
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    return await Notification.query()
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  async deleteNotification(notificationId: string): Promise<void> {
    const notification = await Notification.findOrFail(notificationId)

    await notification.delete()

    // Real-time updates disabled - using static notifications only
  }

  async clearCompletedNotifications(projectId: string): Promise<number> {
    const result = await Notification.query()
      .where('project_id', projectId)
      .where('status', 'completed')
      .delete()

    const deletedCount = Array.isArray(result) ? result.length : result

    // Real-time updates disabled - using static notifications only

    return deletedCount
  }
}
