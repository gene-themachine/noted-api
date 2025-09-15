import FreeResponseSet from '#models/free_response_set'
import FreeResponse from '#models/free_response'
import FreeResponseEvaluation from '#models/free_response_evaluation'
import AuthorizationService from '#services/authorization_service'
import { getCompletion } from '../utils/openai.js'
import { createFreeResponseEvaluationPrompt } from '../prompts/free_response.js'
import { extractJsonFromResponse } from '../prompts/shared.js'

export class FreeResponseService {
  private authService: AuthorizationService

  constructor() {
    this.authService = new AuthorizationService()
  }

  /**
   * Get project free response sets for a user
   */
  async getProjectFreeResponseSets(userId: string, projectId: string) {
    // Verify project access
    await this.authService.getProjectForUser(userId, projectId)

    const freeResponseSets = await FreeResponseSet.query()
      .where('project_id', projectId)
      .where('user_id', userId)
      .preload('notes')
      .preload('libraryItems')
      .preload('freeResponses')
      .orderBy('created_at', 'desc')

    return freeResponseSets
  }

  /**
   * Get a specific free response set
   */
  async getFreeResponseSet(userId: string, setId: string) {
    const freeResponseSet = await FreeResponseSet.query()
      .where('id', setId)
      .where('user_id', userId)
      .preload('notes')
      .preload('libraryItems')
      .preload('freeResponses')
      .first()

    if (!freeResponseSet) {
      throw new Error('Free response set not found or access denied')
    }

    return freeResponseSet
  }

  /**
   * Update a free response set
   */
  async updateFreeResponseSet(userId: string, setId: string, payload: { name: string }) {
    const freeResponseSet = await this.getFreeResponseSet(userId, setId)

    // Update the set name
    freeResponseSet.name = payload.name
    await freeResponseSet.save()

    return freeResponseSet
  }

  /**
   * Delete a free response set and all its questions
   */
  async deleteFreeResponseSet(userId: string, setId: string) {
    const freeResponseSet = await this.getFreeResponseSet(userId, setId)

    // Delete all evaluations first
    const freeResponseIds = await FreeResponse.query()
      .where('free_response_set_id', setId)
      .select('id')

    for (const response of freeResponseIds) {
      await FreeResponseEvaluation.query().where('free_response_id', response.id).delete()
    }

    // Delete all questions
    await FreeResponse.query().where('free_response_set_id', setId).delete()

    // Delete the set
    await freeResponseSet.delete()
  }

  /**
   * Evaluate a user's response to a free response question
   */
  async evaluateUserResponse(userId: string, freeResponseId: string, userAnswer: string) {
    // Get the free response question
    const freeResponse = await FreeResponse.query()
      .where('id', freeResponseId)
      .preload('freeResponseSet')
      .first()

    if (!freeResponse) {
      throw new Error('Free response question not found')
    }

    // Verify user has access to this set
    if (freeResponse.freeResponseSet.userId !== userId) {
      throw new Error('Access denied to this free response set')
    }

    // Use AI to evaluate the response against the rubric
    const evaluation = await this.createAIEvaluation(
      freeResponseId,
      userId,
      userAnswer,
      freeResponse.question,
      freeResponse.answer,
      freeResponse.rubric || []
    )

    return evaluation
  }

  /**
   * Create an AI-powered evaluation using the rubric
   */
  private async createAIEvaluation(
    freeResponseId: string,
    userId: string,
    userAnswer: string,
    question: string,
    expectedAnswer: string,
    rubric: Array<{ criterion: string; points: number }>
  ) {
    try {
      // If no rubric is provided, fall back to basic evaluation
      if (!rubric || rubric.length === 0) {
        return await this.createFallbackEvaluation(
          freeResponseId,
          userId,
          userAnswer,
          expectedAnswer
        )
      }

      // Create AI evaluation prompt
      const prompt = createFreeResponseEvaluationPrompt(
        question,
        expectedAnswer,
        userAnswer,
        rubric
      )

      // Get AI evaluation
      const response = await getCompletion(prompt, 'gpt-4o')
      const aiEvaluation = extractJsonFromResponse(response)

      if (!aiEvaluation) {
        console.error('Failed to parse AI evaluation response')
        return await this.createFallbackEvaluation(
          freeResponseId,
          userId,
          userAnswer,
          expectedAnswer
        )
      }

      // Create evaluation record with AI results
      const evaluation = await FreeResponseEvaluation.create({
        freeResponseId,
        userId,
        userAnswer,
        score: aiEvaluation.percentage || aiEvaluation.totalScore || 0,
        isCorrect: aiEvaluation.isCorrect || aiEvaluation.percentage >= 70,
        feedback: aiEvaluation.overallFeedback || null,
        keyPoints: aiEvaluation.keyStrengths || [],
        improvements: aiEvaluation.areasForImprovement || [],
        criteriaScores: aiEvaluation.criteriaScores || [],
        overallFeedback: aiEvaluation.overallFeedback || null,
        keyStrengths: aiEvaluation.keyStrengths || [],
        areasForImprovement: aiEvaluation.areasForImprovement || [],
      })

      console.log(
        `✅ AI evaluation completed: ${evaluation.score}% (${evaluation.isCorrect ? 'Correct' : 'Needs improvement'})`
      )
      return evaluation
    } catch (error) {
      console.error('Error in AI evaluation:', error)
      // Fall back to basic evaluation if AI fails
      return await this.createFallbackEvaluation(freeResponseId, userId, userAnswer, expectedAnswer)
    }
  }

  /**
   * Fallback evaluation when AI is not available or fails
   */
  private async createFallbackEvaluation(
    freeResponseId: string,
    userId: string,
    userAnswer: string,
    expectedAnswer: string
  ) {
    // Basic keyword matching as fallback
    const userWords = userAnswer.toLowerCase().split(/\s+/)
    const expectedWords = expectedAnswer.toLowerCase().split(/\s+/)
    const matchingWords = userWords.filter((word) => expectedWords.includes(word))

    const score = Math.min(100, Math.round((matchingWords.length / expectedWords.length) * 100))
    const isCorrect = score >= 70

    const evaluation = await FreeResponseEvaluation.create({
      freeResponseId,
      userId,
      userAnswer,
      score,
      isCorrect,
      feedback: isCorrect
        ? 'Good answer! Your response covers the key points.'
        : 'Your answer could be improved. Try to include more specific details.',
      keyPoints: isCorrect ? ['Covers main concepts'] : [],
      improvements: isCorrect ? [] : ['Add more specific details', 'Include key terminology'],
      criteriaScores: [],
      overallFeedback: isCorrect
        ? 'Good answer! Your response covers the key points.'
        : 'Your answer could be improved. Try to include more specific details.',
      keyStrengths: isCorrect ? ['Shows understanding of main concepts'] : [],
      areasForImprovement: isCorrect
        ? []
        : ['Add more specific details', 'Include key terminology'],
    })

    return evaluation
  }

  /**
   * Get evaluation history for a user and question
   */
  async getEvaluationHistory(userId: string, freeResponseId: string) {
    const evaluations = await FreeResponseEvaluation.query()
      .where('free_response_id', freeResponseId)
      .where('user_id', userId)
      .orderBy('created_at', 'desc')

    return evaluations
  }
}
