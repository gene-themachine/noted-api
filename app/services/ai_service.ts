import { v4 as uuidv4 } from 'uuid'
import { DateTime } from 'luxon'
import Database from '@adonisjs/lucid/services/db'
import Note from '#models/note'
import LibraryItem from '#models/library_item'
import env from '#start/env'
import { getCompletion, truncateToTokenLimit } from '../utils/openai.js'
import { downloadAndExtractText } from '../utils/pdf_extractor.js'
import { createFlashcardPrompt } from '../prompts/flashcard.js'
import { createMultipleChoicePrompt } from '../prompts/multiple_choice.js'
import { createFreeResponsePrompt } from '../prompts/free_response.js'
import { extractJsonFromResponse, combineContentSources } from '../prompts/shared.js'

export interface FlashcardGenerationData {
  flashcardSetId: string
  userId: string
  projectId: string
  selectedNoteIds: string[]
  selectedLibraryItemIds: string[]
}

export interface MultipleChoiceGenerationData {
  multipleChoiceSetId: string
  userId: string
  projectId: string
  selectedNoteIds: string[]
  selectedLibraryItemIds: string[]
}

export interface FreeResponseGenerationData {
  freeResponseSetId: string
  userId: string
  projectId: string
  selectedNoteIds: string[]
  selectedLibraryItemIds: string[]
}

export default class AIService {
  private defaultModel = env.get('DEFAULT_AI_MODEL', 'gpt-4o')

  async generateFlashcardSet(data: FlashcardGenerationData) {
    const { flashcardSetId, userId, projectId, selectedNoteIds, selectedLibraryItemIds } = data

    console.log(`🎯 Starting flashcard set generation for set: ${flashcardSetId}`)
    console.log(`👤 User: ${userId}`)
    console.log(`📁 Project: ${projectId}`)
    console.log(`📄 Notes: ${selectedNoteIds.length}`)
    console.log(`📚 Library items: ${selectedLibraryItemIds.length}`)

    if (!flashcardSetId) {
      throw new Error('Missing flashcardSetId')
    }

    try {
      const contentSources: string[] = []
      const setName = `Flashcard Set ${flashcardSetId}`

      // 1. Fetch content from all selected notes
      for (const noteId of selectedNoteIds) {
        console.log(`📄 Fetching note: ${noteId}`)
        const noteData = await this.fetchNoteData(noteId, userId)
        if (noteData) {
          const noteContent = noteData.content || ''
          const noteName = noteData.name || 'Untitled Note'
          if (noteContent.trim()) {
            contentSources.push(`=== Note: ${noteName} ===\n${noteContent}`)
            console.log(`✅ Added note content (${noteContent.length} chars)`)
          } else {
            console.log(`⚠️ Note ${noteId} content is empty`)
          }
        } else {
          console.log(`❌ Could not fetch note ${noteId}`)
        }
      }

      // 2. Fetch content from selected library items
      if (selectedLibraryItemIds.length > 0) {
        console.log(`📚 Fetching ${selectedLibraryItemIds.length} library items`)
        const libraryItems = await this.fetchLibraryItems(selectedLibraryItemIds, projectId)
        if (libraryItems.length > 0) {
          const fileContent = await this.extractContentFromFiles(libraryItems)
          if (fileContent.trim()) {
            contentSources.push(fileContent)
            console.log(`✅ Added library content (${fileContent.length} chars)`)
          } else {
            console.log('⚠️ No content extracted from library items')
          }
        }
      }

      // 3. Validate we have content to work with
      if (contentSources.length === 0) {
        throw new Error('No content available for flashcard set generation')
      }

      console.log(`📝 Total content sources: ${contentSources.length}`)

      // 4. Generate flashcards using AI
      const flashcards = await this.generateFlashcardsWithAI(contentSources, setName)

      if (!flashcards || flashcards.length === 0) {
        throw new Error('AI failed to generate flashcards')
      }

      // 5. Save flashcards to database with set association
      const success = await this.saveFlashcardSetToDatabase(
        flashcards,
        flashcardSetId,
        userId,
        projectId
      )

      if (success) {
        console.log(
          `✅ Flashcard set generation completed successfully - ${flashcards.length} flashcards created`
        )
        return {
          status: 'success',
          message: `Generated ${flashcards.length} flashcards successfully`,
          flashcardsCount: flashcards.length,
        }
      } else {
        throw new Error('Failed to save flashcards to database')
      }
    } catch (error) {
      console.error(`❌ Flashcard set generation failed: ${error}`)
      throw error
    }
  }

  async generateMultipleChoiceSet(data: MultipleChoiceGenerationData) {
    const { multipleChoiceSetId, userId, projectId, selectedNoteIds, selectedLibraryItemIds } = data

    console.log(`🎯 Starting multiple choice set generation for set: ${multipleChoiceSetId}`)
    console.log(`👤 User: ${userId}`)
    console.log(`📁 Project: ${projectId}`)
    console.log(`📄 Notes: ${selectedNoteIds.length}`)
    console.log(`📚 Library items: ${selectedLibraryItemIds.length}`)

    if (!multipleChoiceSetId) {
      throw new Error('Missing multipleChoiceSetId')
    }

    try {
      const contentSources: string[] = []
      const setName = `Multiple Choice Set ${multipleChoiceSetId}`

      // 1. Fetch content from all selected notes
      for (const noteId of selectedNoteIds) {
        console.log(`📄 Fetching note: ${noteId}`)
        const noteData = await this.fetchNoteData(noteId, userId)
        if (noteData) {
          const noteContent = noteData.content || ''
          const noteName = noteData.name || 'Untitled Note'
          if (noteContent.trim()) {
            contentSources.push(`=== Note: ${noteName} ===\n${noteContent}`)
            console.log(`✅ Added note content (${noteContent.length} chars)`)
          } else {
            console.log(`⚠️ Note ${noteId} content is empty`)
          }
        } else {
          console.log(`❌ Could not fetch note ${noteId}`)
        }
      }

      // 2. Fetch content from selected library items
      if (selectedLibraryItemIds.length > 0) {
        console.log(`📚 Fetching ${selectedLibraryItemIds.length} library items`)
        const libraryItems = await this.fetchLibraryItems(selectedLibraryItemIds, projectId)
        if (libraryItems.length > 0) {
          const fileContent = await this.extractContentFromFiles(libraryItems)
          if (fileContent.trim()) {
            contentSources.push(fileContent)
            console.log(`✅ Added library content (${fileContent.length} chars)`)
          } else {
            console.log('⚠️ No content extracted from library items')
          }
        }
      }

      // 3. Validate we have content to work with
      if (contentSources.length === 0) {
        throw new Error('No content available for multiple choice set generation')
      }

      console.log(`📝 Total content sources: ${contentSources.length}`)

      // 4. Generate questions using AI
      const questions = await this.generateMultipleChoiceWithAI(contentSources, setName)

      if (!questions || questions.length === 0) {
        throw new Error('AI failed to generate multiple choice questions')
      }

      // 5. Save questions to database with set association
      const success = await this.saveMultipleChoiceSetToDatabase(questions, multipleChoiceSetId)

      if (success) {
        console.log(
          `✅ Multiple choice set generation completed successfully - ${questions.length} questions created`
        )
        return {
          status: 'success',
          message: `Generated ${questions.length} questions successfully`,
          questionsCount: questions.length,
        }
      } else {
        throw new Error('Failed to save questions to database')
      }
    } catch (error) {
      console.error(`❌ Multiple choice set generation failed: ${error}`)
      throw error
    }
  }

  async generateFreeResponseSet(data: FreeResponseGenerationData) {
    const { freeResponseSetId, userId, projectId, selectedNoteIds, selectedLibraryItemIds } = data

    console.log(`🎯 Starting free response set generation for set: ${freeResponseSetId}`)
    console.log(`👤 User: ${userId}`)
    console.log(`📁 Project: ${projectId}`)
    console.log(`📄 Notes: ${selectedNoteIds.length}`)
    console.log(`📚 Library items: ${selectedLibraryItemIds.length}`)

    if (!freeResponseSetId) {
      throw new Error('Missing freeResponseSetId')
    }

    try {
      const contentSources: string[] = []
      const setName = `Free Response Set ${freeResponseSetId}`

      // 1. Fetch content from all selected notes
      for (const noteId of selectedNoteIds) {
        console.log(`📄 Fetching note: ${noteId}`)
        const noteData = await this.fetchNoteData(noteId, userId)
        if (noteData) {
          const noteContent = noteData.content || ''
          const noteName = noteData.name || 'Untitled Note'
          if (noteContent.trim()) {
            contentSources.push(`=== Note: ${noteName} ===\n${noteContent}`)
            console.log(`✅ Added note content (${noteContent.length} chars)`)
          } else {
            console.log(`⚠️ Note ${noteId} content is empty`)
          }
        } else {
          console.log(`❌ Could not fetch note ${noteId}`)
        }
      }

      // 2. Fetch content from selected library items
      if (selectedLibraryItemIds.length > 0) {
        console.log(`📚 Fetching ${selectedLibraryItemIds.length} library items`)
        const libraryItems = await this.fetchLibraryItems(selectedLibraryItemIds, projectId)
        if (libraryItems.length > 0) {
          const fileContent = await this.extractContentFromFiles(libraryItems)
          if (fileContent.trim()) {
            contentSources.push(fileContent)
            console.log(`✅ Added library content (${fileContent.length} chars)`)
          } else {
            console.log('⚠️ No content extracted from library items')
          }
        }
      }

      // 3. Validate we have content to work with
      if (contentSources.length === 0) {
        throw new Error('No content available for free response set generation')
      }

      console.log(`📝 Total content sources: ${contentSources.length}`)

      // 4. Generate questions using AI
      const questions = await this.generateFreeResponseWithAI(contentSources, setName)

      if (!questions || questions.length === 0) {
        throw new Error('AI failed to generate free response questions')
      }

      // 5. Save questions to database with set association
      const success = await this.saveFreeResponseSetToDatabase(questions, freeResponseSetId)

      if (success) {
        console.log(
          `✅ Free response set generation completed successfully - ${questions.length} questions created`
        )
        return {
          status: 'success',
          message: `Generated ${questions.length} questions successfully`,
          questionsCount: questions.length,
        }
      } else {
        throw new Error('Failed to save questions to database')
      }
    } catch (error) {
      console.error(`❌ Free response set generation failed: ${error}`)
      throw error
    }
  }

  private async fetchNoteData(noteId: string, userId: string) {
    console.log(`📄 Fetching note data for note: ${noteId}`)
    try {
      const note = await Note.query().where('id', noteId).where('user_id', userId).first()

      if (note) {
        console.log(`✅ Note fetched: '${note.name}' (${note.content?.length || 0} chars)`)
        return note
      } else {
        console.log('❌ Note not found or access denied')
        return null
      }
    } catch (error) {
      console.error(`❌ Error fetching note data: ${error}`)
      throw error
    }
  }

  private async fetchLibraryItems(libraryItemIds: string[], projectId: string) {
    if (libraryItemIds.length === 0) {
      console.log('📚 No library items to fetch')
      return []
    }

    console.log(`📚 Fetching ${libraryItemIds.length} library items`)
    try {
      const items = await LibraryItem.query()
        .whereIn('id', libraryItemIds)
        .where((query) => {
          query.where('is_global', true).orWhere('project_id', projectId)
        })

      console.log(`✅ Fetched ${items.length} library items`)
      items.forEach((item) => {
        console.log(`   - ${item.name} (${item.mimeType})`)
      })
      return items
    } catch (error) {
      console.error(`❌ Error fetching library items: ${error}`)
      throw error
    }
  }

  private async extractContentFromFiles(libraryItems: LibraryItem[]): Promise<string> {
    if (libraryItems.length === 0) {
      return ''
    }

    console.log(`📥 Processing ${libraryItems.length} files for text extraction`)
    const combinedContent: string[] = []

    for (const item of libraryItems) {
      try {
        console.log(`📥 Processing: ${item.name}`)
        let s3Key = item.storagePath

        // If storage_path is a full URL, extract the key
        if (s3Key.startsWith('http')) {
          s3Key = s3Key.split('amazonaws.com/')[1]
        }

        const textContent = await downloadAndExtractText(s3Key)
        if (textContent) {
          combinedContent.push(`=== Content from ${item.name} ===\n${textContent}\n`)
          console.log(`✅ Extracted ${textContent.length} characters from ${item.name}`)
        } else {
          console.log(`⚠️ No text extracted from ${item.name}`)
        }
      } catch (error) {
        console.error(`❌ Error processing ${item.name}: ${error}`)
        // Continue with other files even if one fails
      }
    }

    const combinedText = combinedContent.join('\n')
    console.log(`✅ Total extracted content: ${combinedText.length} characters`)
    return combinedText
  }

  private async generateFlashcardsWithAI(
    contentSources: string[],
    noteName: string
  ): Promise<Array<{ term: string; definition: string }>> {
    console.log(`🤖 Generating flashcards using AI for: '${noteName}'`)

    // Combine all content sources
    const combinedContent = combineContentSources(contentSources)

    if (!combinedContent.trim()) {
      console.log('❌ No content available for flashcard generation')
      return []
    }

    console.log(`📝 Processing ${combinedContent.length} characters of content`)

    // Truncate if necessary
    const truncatedContent = truncateToTokenLimit(combinedContent)

    // Create AI prompt for flashcard generation
    const prompt = createFlashcardPrompt(truncatedContent)

    try {
      const response = await getCompletion(prompt, this.defaultModel)
      console.log(`✅ AI response received (${response.length} characters)`)

      // Parse the JSON response
      const parsedResponse = extractJsonFromResponse(response)
      if (parsedResponse && parsedResponse.flashcards) {
        const flashcards = parsedResponse.flashcards
        console.log(`✅ Successfully parsed ${flashcards.length} flashcards`)
        return flashcards
      } else {
        return []
      }
    } catch (error) {
      console.error(`❌ Error generating flashcards with AI: ${error}`)
      return []
    }
  }

  private async generateMultipleChoiceWithAI(
    contentSources: string[],
    setName: string
  ): Promise<Array<{ question: string; answer: string }>> {
    console.log(`🤖 Generating multiple choice questions using AI for set: '${setName}'`)

    // Combine all content sources
    const combinedContent = combineContentSources(contentSources)

    if (!combinedContent.trim()) {
      console.log('❌ No content available for multiple choice generation')
      return []
    }

    console.log(`📝 Processing ${combinedContent.length} characters of content`)

    // Truncate if necessary
    const truncatedContent = truncateToTokenLimit(combinedContent)

    // Create AI prompt for multiple choice generation
    const prompt = createMultipleChoicePrompt(truncatedContent)

    try {
      const response = await getCompletion(prompt, this.defaultModel)
      console.log(`✅ AI response received (${response.length} characters)`)

      // Parse the JSON response
      const parsedResponse = extractJsonFromResponse(response)
      if (parsedResponse && parsedResponse.questions) {
        const questions = parsedResponse.questions
        console.log(`✅ Successfully parsed ${questions.length} questions`)
        return questions
      } else {
        return []
      }
    } catch (error) {
      console.error(`❌ Error generating multiple choice questions with AI: ${error}`)
      return []
    }
  }

  private async generateFreeResponseWithAI(
    contentSources: string[],
    setName: string
  ): Promise<
    Array<{
      question: string
      answer: string
      rubric: Array<{ criterion: string; points: number }>
    }>
  > {
    console.log(`🤖 Generating free response questions using AI for set: '${setName}'`)

    // Combine all content sources
    const combinedContent = combineContentSources(contentSources)

    if (!combinedContent.trim()) {
      console.log('❌ No content available for free response generation')
      return []
    }

    console.log(`📝 Processing ${combinedContent.length} characters of content`)

    // Truncate if necessary
    const truncatedContent = truncateToTokenLimit(combinedContent)

    // Create AI prompt for free response generation
    const prompt = createFreeResponsePrompt(truncatedContent, setName)

    try {
      const response = await getCompletion(prompt, this.defaultModel)
      console.log(`✅ AI response received (${response.length} characters)`)

      // Parse the JSON response
      const parsedResponse = extractJsonFromResponse(response)
      if (Array.isArray(parsedResponse)) {
        const questions = parsedResponse
        console.log(`✅ Successfully parsed ${questions.length} free response questions`)
        return questions
      } else {
        return []
      }
    } catch (error) {
      console.error(`❌ Error generating free response questions with AI: ${error}`)
      return []
    }
  }

  private async saveFlashcardSetToDatabase(
    flashcards: Array<{ term: string; definition: string }>,
    flashcardSetId: string,
    userId: string,
    projectId: string
  ): Promise<boolean> {
    if (flashcards.length === 0) {
      console.log('❌ No flashcards to save')
      return false
    }

    console.log(`💾 Saving ${flashcards.length} flashcards to database for set ${flashcardSetId}`)

    const trx = await Database.transaction()

    try {
      // Prepare flashcard records
      const flashcardRecords = flashcards.map((flashcard) => ({
        id: uuidv4(),
        flashcard_set_id: flashcardSetId,
        user_id: userId,
        project_id: projectId,
        term: flashcard.term,
        definition: flashcard.definition,
        created_at: DateTime.utc().toSQL(),
        updated_at: DateTime.utc().toSQL(),
      }))

      // Insert flashcards
      await trx.table('flashcards').insert(flashcardRecords)
      console.log(`✅ Successfully inserted ${flashcardRecords.length} flashcards`)

      await trx.commit()
      return true
    } catch (error) {
      await trx.rollback()
      console.error(`❌ Error saving flashcards to database: ${error}`)
      throw error
    }
  }

  private async saveMultipleChoiceSetToDatabase(
    questions: Array<{ question: string; answer: string }>,
    multipleChoiceSetId: string
  ): Promise<boolean> {
    if (questions.length === 0) {
      console.log('❌ No questions to save')
      return false
    }

    console.log(
      `💾 Saving ${questions.length} questions to database for set ${multipleChoiceSetId}`
    )

    const trx = await Database.transaction()

    try {
      // Prepare question records
      const questionRecords = questions.map((question) => ({
        id: uuidv4(),
        multiple_choice_set_id: multipleChoiceSetId,
        question: question.question,
        answer: question.answer,
        created_at: DateTime.utc().toSQL(),
        updated_at: DateTime.utc().toSQL(),
      }))

      // Insert questions
      await trx.table('multiple_choice_questions').insert(questionRecords)
      console.log(`✅ Successfully inserted ${questionRecords.length} questions`)

      await trx.commit()
      return true
    } catch (error) {
      await trx.rollback()
      console.error(`❌ Error saving questions to database: ${error}`)
      throw error
    }
  }

  private async saveFreeResponseSetToDatabase(
    questions: Array<{
      question: string
      answer: string
      rubric: Array<{ criterion: string; points: number }>
    }>,
    freeResponseSetId: string
  ): Promise<boolean> {
    if (questions.length === 0) {
      console.log('❌ No questions to save')
      return false
    }

    console.log(
      `💾 Saving ${questions.length} free response questions to database for set ${freeResponseSetId}`
    )

    const trx = await Database.transaction()

    try {
      // Prepare question records
      const now = DateTime.utc()
      const questionRecords = questions.map((question, index) => {
        // Validate rubric data
        const rubric = Array.isArray(question.rubric) ? question.rubric : []
        console.log(`Question ${index + 1} rubric:`, rubric)

        return {
          id: uuidv4(),
          free_response_set_id: freeResponseSetId,
          question: question.question,
          answer: question.answer,
          rubric: JSON.stringify(rubric),
          created_at: now.toSQL(),
          updated_at: now.toSQL(),
        }
      })

      // Insert questions
      await trx.table('free_responses').insert(questionRecords)
      console.log(`✅ Successfully inserted ${questionRecords.length} free response questions`)

      await trx.commit()
      console.log('✅ Transaction committed successfully')
      return true
    } catch (error) {
      console.error('❌ Error saving free response questions to database:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
      })
      try {
        await trx.rollback()
        console.log('✅ Transaction rolled back')
      } catch (rollbackError) {
        console.error('❌ Error during rollback:', rollbackError)
      }
      throw error
    }
  }
}
