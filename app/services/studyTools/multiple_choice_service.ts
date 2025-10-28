import { v4 as uuidv4 } from 'uuid'
import { DateTime } from 'luxon'
import Database from '@adonisjs/lucid/services/db'
import MultipleChoiceSet from '#models/multiple_choice_set'
import MultipleChoiceQuestion from '#models/multiple_choice_question'
import env from '#start/env'
import { getCompletion, truncateToTokenLimit } from '../../utils/openai.js'
import { createMultipleChoicePrompt } from '../../prompts/multiple_choice.js'
import { extractJsonFromResponse, combineContentSources } from '../../prompts/shared.js'

export class MultipleChoiceService {
  private model = env.get('DEFAULT_AI_MODEL', 'gpt-4o')

  /**
   * Get project multiple choice sets for a user
   * Authorization: Database filters by userId ensure user can only access their own data
   */
  async getProjectMultipleChoiceSets(userId: string, projectId: string) {
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

  /**
   * Generate multiple choice questions from content using AI
   */
  async generateFromContent(
    contentSources: string[],
    multipleChoiceSetId: string
  ): Promise<number> {
    const combined = combineContentSources(contentSources)
    const truncated = truncateToTokenLimit(combined)
    const prompt = createMultipleChoicePrompt(truncated)

    const response = await getCompletion(prompt, this.model)
    const parsed = extractJsonFromResponse(response)
    const questions = parsed?.questions || []

    if (questions.length === 0) {
      throw new Error('AI failed to generate questions')
    }

    await this.saveQuestionsToDatabase(questions, multipleChoiceSetId)
    return questions.length
  }

  /**
   * Save questions to database
   */
  private async saveQuestionsToDatabase(
    questions: Array<{ question: string; answer: string }>,
    setId: string
  ): Promise<void> {
    const trx = await Database.transaction()

    try {
      const records = questions.map((q) => ({
        id: uuidv4(),
        multiple_choice_set_id: setId,
        question: q.question,
        answer: q.answer,
        created_at: DateTime.utc().toSQL(),
        updated_at: DateTime.utc().toSQL(),
      }))

      await trx.table('multiple_choice_questions').insert(records)
      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}
