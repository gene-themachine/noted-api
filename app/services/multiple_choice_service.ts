import MultipleChoiceSet from '#models/multiple_choice_set'
import MultipleChoiceQuestion from '#models/multiple_choice_question'
import AuthorizationService from '#services/authorization_service'

export class MultipleChoiceService {
  private authService: AuthorizationService

  constructor() {
    this.authService = new AuthorizationService()
  }

  /**
   * Get project multiple choice sets for a user
   */
  async getProjectMultipleChoiceSets(userId: string, projectId: string) {
    // Verify project access
    await this.authService.getProjectForUser(userId, projectId)

    const multipleChoiceSets = await MultipleChoiceSet.query()
      .where('project_id', projectId)
      .where('user_id', userId)
      .preload('notes')
      .preload('libraryItems')
      .preload('multipleChoiceQuestions')
      .orderBy('created_at', 'desc')

    return multipleChoiceSets
  }

  /**
   * Get a specific multiple choice set
   */
  async getMultipleChoiceSet(userId: string, setId: string) {
    const multipleChoiceSet = await MultipleChoiceSet.query()
      .where('id', setId)
      .where('user_id', userId)
      .preload('notes')
      .preload('libraryItems')
      .preload('multipleChoiceQuestions')
      .first()

    if (!multipleChoiceSet) {
      throw new Error('Multiple choice set not found or access denied')
    }

    return multipleChoiceSet
  }

  /**
   * Update a multiple choice set
   */
  async updateMultipleChoiceSet(userId: string, setId: string, payload: { name: string }) {
    const multipleChoiceSet = await this.getMultipleChoiceSet(userId, setId)

    // Update the set name
    multipleChoiceSet.name = payload.name
    await multipleChoiceSet.save()

    return multipleChoiceSet
  }

  /**
   * Delete a multiple choice set and all its questions
   */
  async deleteMultipleChoiceSet(userId: string, setId: string) {
    const multipleChoiceSet = await this.getMultipleChoiceSet(userId, setId)

    // Delete all questions first
    await MultipleChoiceQuestion.query().where('multiple_choice_set_id', setId).delete()

    // Delete the set
    await multipleChoiceSet.delete()
  }
}
