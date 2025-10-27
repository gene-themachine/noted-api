import NativePineconeService from './native_pinecone_service.js'
import type { VectorRecord } from '#types/vector.types'
import Note from '#models/note'
import LibraryItem from '#models/library_item'
import VectorChunk from '#models/vector_chunk'
import NoteService from './note_service.js'
import { downloadAndExtractText } from '../utils/pdf_extractor.js'
import { getEmbeddings } from '../utils/openai.js'
import { v4 as uuidv4 } from 'uuid'
import { DateTime } from 'luxon'
import { TextChunk } from '#types/common.types'

/**
 * Native vector service using direct SDK calls without LangChain
 */
export default class NativeVectorService {
  private pineconeService: NativePineconeService
  private noteService: NoteService

  constructor() {
    this.pineconeService = new NativePineconeService()
    this.noteService = new NoteService()
  }

  /**
   * Simple text splitter (character-based with overlap)
   */
  private splitText(text: string, chunkSize: number = 1000, overlap: number = 200): TextChunk[] {
    const chunks: TextChunk[] = []
    let index = 0
    let chunkIndex = 0

    while (index < text.length) {
      const end = Math.min(index + chunkSize, text.length)
      const chunk = text.slice(index, end)

      chunks.push({
        content: chunk,
        index: chunkIndex++,
      })

      // Move forward by (chunkSize - overlap)
      index += chunkSize - overlap

      // Prevent infinite loop if overlap >= chunkSize
      if (index <= chunks[chunks.length - 1].index * (chunkSize - overlap)) {
        index = chunks[chunks.length - 1].index * (chunkSize - overlap) + chunkSize
      }
    }

    return chunks
  }

  /**
   * Process and vectorize a note
   */
  async vectorizeNote(noteId: string): Promise<void> {
    try {
      const note = await Note.find(noteId)
      if (!note || !note.content?.trim()) {
        await Note.query().where('id', noteId).update({
          vectorStatus: 'completed',
          vectorUpdatedAt: DateTime.now(),
        })
        return
      }

      console.log(`🔄 Vectorizing note: ${noteId}`)

      // Update status to processing
      await Note.query().where('id', noteId).update({
        vectorStatus: 'processing',
        vectorUpdatedAt: DateTime.now(),
      })

      // Delete existing note vectors
      await this.deleteNoteVectors(noteId)

      // Split text into chunks
      const chunks = this.splitText(note.content, 1000, 200)

      if (chunks.length === 0) {
        await Note.query().where('id', noteId).update({
          vectorStatus: 'completed',
          vectorUpdatedAt: DateTime.now(),
        })
        return
      }

      // Generate embeddings for all chunks
      const chunkTexts = chunks.map((c) => c.content)
      const embeddings = await getEmbeddings(chunkTexts)

      // Prepare vectors for Pinecone
      const vectors: VectorRecord[] = []
      const dbChunks = []

      for (const [i] of chunks.entries()) {
        const chunkId = uuidv4()
        const pineconeId = `${noteId}_note_${i}`

        vectors.push({
          id: pineconeId,
          values: embeddings[i],
          metadata: {
            noteId,
            projectId: note.projectId,
            contentType: 'note',
            chunkId,
            userId: note.userId,
            text: chunks[i].content,
            chunkIndex: i,
            chunkSize: chunks[i].content.length,
          },
        })

        dbChunks.push({
          id: chunkId,
          noteId,
          userId: note.userId!,
          contentType: 'note' as const,
          content: chunks[i].content,
          chunkIndex: i,
          chunkSize: chunks[i].content.length,
          pineconeId,
          vectorStatus: 'completed' as const,
        })
      }

      // Store in Pinecone
      if (vectors.length > 0) {
        await this.pineconeService.upsert(vectors)

        // Store metadata in database
        await VectorChunk.createMany(dbChunks)
      }

      // Update status to completed
      await Note.query().where('id', noteId).update({
        vectorStatus: 'completed',
        vectorUpdatedAt: DateTime.now(),
      })

      console.log(`✅ Note vectorized: ${noteId} (${vectors.length} chunks)`)
    } catch (error) {
      console.error(`❌ Note vectorization failed: ${error.message}`)
      await Note.query().where('id', noteId).update({
        vectorStatus: 'failed',
        vectorUpdatedAt: DateTime.now(),
      })
      throw error
    }
  }

  /**
   * Process and vectorize a library item
   */
  async vectorizeLibraryItem(libraryItemId: string): Promise<void> {
    try {
      const libraryItem = await LibraryItem.query()
        .where('id', libraryItemId)
        .preload('project')
        .preload('note')
        .firstOrFail()

      console.log(`🔄 Vectorizing library item: ${libraryItemId}`)

      // Update status to processing
      await LibraryItem.query().where('id', libraryItemId).update({
        vectorStatus: 'processing',
        vectorUpdatedAt: DateTime.now(),
      })

      // Delete existing library item vectors
      await this.deleteLibraryItemVectors(libraryItemId)

      // Extract text content
      let content: string
      if (libraryItem.storagePath) {
        content = await downloadAndExtractText(libraryItem.storagePath)
      } else {
        throw new Error('Library item has no storage path')
      }

      if (!content?.trim()) {
        await LibraryItem.query().where('id', libraryItemId).update({
          vectorStatus: 'completed',
          vectorUpdatedAt: DateTime.now(),
        })
        return
      }

      // Determine note association
      let noteId = libraryItem.noteId || libraryItem.note?.id

      // If no note association, use system note for this project
      if (!noteId) {
        console.log(`📝 Library item ${libraryItemId} has no note association, using system note`)
        const systemNote = await this.noteService.getOrCreateLibrarySystemNote(
          libraryItem.projectId,
          libraryItem.project.userId
        )
        noteId = systemNote.id
      }

      // Split text into chunks
      const chunks = this.splitText(content, 1000, 200)

      if (chunks.length === 0) {
        await LibraryItem.query().where('id', libraryItemId).update({
          vectorStatus: 'completed',
          vectorUpdatedAt: DateTime.now(),
        })
        return
      }

      // Generate embeddings for all chunks
      const chunkTexts = chunks.map((c) => c.content)
      const embeddings = await getEmbeddings(chunkTexts)

      // Extract metadata
      const author = this.extractAuthor(libraryItem.name, content)
      const title = this.extractTitle(libraryItem.name, content)

      // Prepare vectors for Pinecone
      const vectors: VectorRecord[] = []
      const dbChunks = []

      for (const [i] of chunks.entries()) {
        const chunkId = uuidv4()
        const pineconeId = `${noteId}_lib_${libraryItemId}_${i}`

        vectors.push({
          id: pineconeId,
          values: embeddings[i],
          metadata: {
            noteId,
            projectId: libraryItem.projectId,
            libraryItemId,
            contentType: 'library_item',
            chunkId,
            userId: libraryItem.project.userId,
            sourceFile: libraryItem.name,
            author,
            title,
            text: chunks[i].content,
            chunkIndex: i,
            chunkSize: chunks[i].content.length,
          },
        })

        dbChunks.push({
          id: chunkId,
          noteId,
          libraryItemId,
          userId: libraryItem.project.userId,
          contentType: 'library_item' as const,
          content: chunks[i].content,
          chunkIndex: i,
          chunkSize: chunks[i].content.length,
          pineconeId,
          vectorStatus: 'completed' as const,
          sourceFile: libraryItem.name,
          author,
          title,
        })
      }

      // Store in Pinecone
      if (vectors.length > 0) {
        await this.pineconeService.upsert(vectors)

        // Store metadata in database
        await VectorChunk.createMany(dbChunks)
      }

      // Update status to completed
      await LibraryItem.query().where('id', libraryItemId).update({
        vectorStatus: 'completed',
        vectorUpdatedAt: DateTime.now(),
      })

      console.log(`✅ Library item vectorized: ${libraryItemId} (${vectors.length} chunks)`)
    } catch (error) {
      console.error(`❌ Library item vectorization failed: ${error.message}`)
      await LibraryItem.query().where('id', libraryItemId).update({
        vectorStatus: 'failed',
        vectorUpdatedAt: DateTime.now(),
      })
      throw error
    }
  }

  /**
   * Search for Q&A with multi-layer security and active library item filtering
   */
  async searchForQA(noteId: string, question: string, topK: number = 5): Promise<any[]> {
    try {
      // Get note with security validation
      const note = await Note.query().where('id', noteId).first()

      if (!note || !note.projectId) {
        console.error(`❌ Note ${noteId} not found or missing project association`)
        return []
      }

      // Get currently attached library items for this note
      const attachedLibraryItems = await LibraryItem.query()
        .where('noteId', noteId)
        .whereNotNull('noteId') // Only get items with valid note associations
        .where('projectId', note.projectId) // Additional security check
        .select('id')

      const attachedLibraryItemIds = attachedLibraryItems.map((item) => item.id)

      console.log(
        `🔍 Q&A search for note ${noteId}: ${attachedLibraryItemIds.length} attached documents`
      )

      // Multi-layer security filter
      const filter = {
        noteId, // Note-level isolation
        userId: note.userId, // User-level isolation (CRITICAL for SaaS)
        projectId: note.projectId, // Project-level isolation
      }

      const results = await this.pineconeService.query(question, topK, filter)

      // Additional filtering: only include results from currently attached library items
      const filteredResults = results.filter((result) => {
        // Always include note content
        if (result.metadata.contentType === 'note') {
          return true
        }

        // For library items, only include if currently attached
        if (result.metadata.contentType === 'library_item') {
          return attachedLibraryItemIds.includes(result.metadata.libraryItemId)
        }

        return false
      })

      console.log(
        `🔍 Filtered ${results.length} → ${filteredResults.length} results (active attachments only)`
      )

      // Enhance results with citation info
      return filteredResults.map((result) => ({
        content: result.content,
        score: result.score,
        metadata: result.metadata,
        sourceType: result.metadata.contentType,
        sourceFile: result.metadata.sourceFile,
        author: result.metadata.author,
        title: result.metadata.title,
      }))
    } catch (error) {
      console.error(`❌ Q&A search failed: ${error.message}`)
      return []
    }
  }

  /**
   * Delete note vectors
   */
  private async deleteNoteVectors(noteId: string): Promise<void> {
    try {
      // Get existing chunks
      const chunks = await VectorChunk.query().where('noteId', noteId).where('contentType', 'note')

      if (chunks.length > 0) {
        const ids = chunks.map((c) => c.pineconeId)
        await this.pineconeService.deleteByIds(ids)

        // Delete from database
        await VectorChunk.query().where('noteId', noteId).where('contentType', 'note').delete()
      }
    } catch (error) {
      console.error(`⚠️ Failed to delete note vectors: ${error.message}`)
    }
  }

  /**
   * Delete library item vectors
   */
  private async deleteLibraryItemVectors(libraryItemId: string): Promise<void> {
    try {
      // Get existing chunks
      const chunks = await VectorChunk.query().where('libraryItemId', libraryItemId)

      if (chunks.length > 0) {
        const ids = chunks.map((c) => c.pineconeId)
        await this.pineconeService.deleteByIds(ids)

        // Delete from database
        await VectorChunk.query().where('libraryItemId', libraryItemId).delete()
      }
    } catch (error) {
      console.error(`⚠️ Failed to delete library item vectors: ${error.message}`)
    }
  }

  /**
   * Extract author from content
   */
  private extractAuthor(filename: string, content: string): string | undefined {
    // Try to extract from filename
    const filenameMatch = filename.match(/by[_\s]+(.+?)(?:\.|_|-|$)/i)
    if (filenameMatch) return filenameMatch[1].trim()

    // Try to extract from content
    const authorPatterns = [
      /(?:Author|By|Written by)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\n/m,
    ]

    for (const pattern of authorPatterns) {
      const match = content.match(pattern)
      if (match) return match[1].trim()
    }

    return undefined
  }

  /**
   * Extract title from content
   */
  private extractTitle(filename: string, content: string): string | undefined {
    // Use filename without extension as fallback
    const baseName = filename.replace(/\.[^/.]+$/, '')

    // Try to extract from content
    const titlePatterns = [/^#\s+(.+)$/m, /^Title[:\s]+(.+)$/im, /^(.+)\n={3,}$/m]

    for (const pattern of titlePatterns) {
      const match = content.match(pattern)
      if (match) return match[1].trim()
    }

    return baseName
  }

  /**
   * Update vector metadata when library item note association changes
   */
  async updateLibraryItemNoteAssociation(
    libraryItemId: string,
    oldNoteId: string | null,
    newNoteId: string | null
  ): Promise<void> {
    try {
      // If no new note ID, get or create system note
      let targetNoteId = newNoteId
      if (!targetNoteId) {
        const libraryItem = await LibraryItem.query()
          .where('id', libraryItemId)
          .preload('project')
          .firstOrFail()

        const systemNote = await this.noteService.getOrCreateLibrarySystemNote(
          libraryItem.projectId,
          libraryItem.project.userId
        )
        targetNoteId = systemNote.id
      }

      console.log(
        `🔄 Updating note association for library item ${libraryItemId}: ${oldNoteId || 'none'} → ${targetNoteId}`
      )

      // Get vector IDs from database instead of using prefix matching
      const vectorChunks = await VectorChunk.query()
        .where('libraryItemId', libraryItemId)
        .select('pineconeId', 'id')

      if (vectorChunks.length === 0) {
        console.log(`ℹ️ No vector chunks found for library item ${libraryItemId}`)
        return
      }

      // Extract Pinecone IDs for metadata update
      const vectorIds = vectorChunks.map((chunk) => chunk.pineconeId).filter((id) => id) // Remove any null/undefined IDs

      if (vectorIds.length > 0) {
        // Update vectors in Pinecone using specific IDs
        await this.pineconeService.updateMetadataByIds(vectorIds, { noteId: targetNoteId })
      }

      // Update database records
      await VectorChunk.query()
        .where('libraryItemId', libraryItemId)
        .update({ noteId: targetNoteId })

      console.log(
        `✅ Updated note association for library item ${libraryItemId} (${vectorIds.length} vectors)`
      )
    } catch (error) {
      console.error(`❌ Failed to update note association: ${error.message}`)
      throw error
    }
  }
}
