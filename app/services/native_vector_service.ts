/**
 * Native Vector Service
 *
 * Handles document vectorization and vector search for RAG:
 * 1. Vectorization: Extract text → Chunk → Embed → Store in Pinecone
 * 2. Search: Query Pinecone for relevant document chunks
 * 3. Metadata: Extract author/title, generate summaries
 */

import NativePineconeService from './native_pinecone_service.js'
import NoteService from './note_service.js'
import Note from '#models/note'
import LibraryItem from '#models/library_item'
import VectorChunk from '#models/vector_chunk'
import type { VectorRecord } from '#types/vector.types'
import type { TextChunk } from '#types/common.types'
import { downloadAndExtractText } from '../utils/pdf_extractor.js'
import { getEmbeddings, getOpenAIClient } from '../utils/openai.js'
import { v4 as uuidv4 } from 'uuid'
import { DateTime } from 'luxon'

export default class NativeVectorService {
  private pineconeService = new NativePineconeService()
  private noteService = new NoteService()

  /**
   * Vectorize a note's content
   */
  async vectorizeNote(noteId: string): Promise<void> {
    const note = await Note.find(noteId)
    if (!note?.content?.trim()) {
      await this.markCompleted('note', noteId)
      return
    }

    console.log(`🔄 Vectorizing note: ${noteId}`)
    await this.updateStatus('note', noteId, 'processing')
    await this.deleteNoteVectors(noteId)

    // Chunk, embed, and store
    const chunks = this.splitText(note.content)
    if (chunks.length === 0) {
      await this.markCompleted('note', noteId)
      return
    }

    const vectors = await this.createVectors(chunks, {
      noteId,
      projectId: note.projectId,
      userId: note.userId!,
      contentType: 'note',
    })

    await this.storeVectors(vectors)
    await this.markCompleted('note', noteId)
    console.log(`✅ Note vectorized: ${noteId} (${vectors.length} chunks)`)
  }

  /**
   * Vectorize a library item (PDF)
   */
  async vectorizeLibraryItem(libraryItemId: string): Promise<void> {
    const libraryItem = await LibraryItem.query()
      .where('id', libraryItemId)
      .preload('project')
      .preload('note')
      .firstOrFail()

    console.log(`🔄 Vectorizing library item: ${libraryItemId}`)
    await this.updateStatus('library', libraryItemId, 'processing')
    await this.deleteLibraryItemVectors(libraryItemId)

    // Extract PDF text
    const content = await downloadAndExtractText(libraryItem.storagePath)
    if (!content?.trim()) {
      await this.markCompleted('library', libraryItemId)
      return
    }

    // Determine note association
    const noteId = await this.getNoteIdForLibraryItem(libraryItem)

    // Chunk, embed, and store
    const chunks = this.splitText(content)
    if (chunks.length === 0) {
      await this.markCompleted('library', libraryItemId)
      return
    }

    const metadata = {
      noteId,
      projectId: libraryItem.projectId,
      userId: libraryItem.project.userId,
      libraryItemId,
      contentType: 'library_item' as const,
      sourceFile: libraryItem.name,
      author: this.extractAuthor(libraryItem.name, content),
      title: this.extractTitle(libraryItem.name, content),
    }

    const vectors = await this.createVectors(chunks, metadata)
    await this.storeVectors(vectors)

    // Generate summary for classification
    const summary = await this.generateSummary(chunks)
    await this.markCompleted('library', libraryItemId, summary)

    console.log(`✅ Library item vectorized: ${libraryItemId} (${vectors.length} chunks)`)
  }

  /**
   * Search for relevant document chunks (used by QA service)
   */
  async searchForQA(noteId: string, question: string, topK: number = 5): Promise<any[]> {
    const note = await Note.query().where('id', noteId).first()
    if (!note) return []

    // Get currently attached library items
    const attachedItems = await LibraryItem.query()
      .where('noteId', noteId)
      .whereNotNull('projectId')
      .select('id')
    const attachedItemIds = attachedItems.map((item) => item.id)

    // Query Pinecone with security filters
    const results = await this.pineconeService.query(question, topK, {
      noteId,
      userId: note.userId,
      projectId: note.projectId,
    })

    // Filter to only include currently attached items
    const filtered = results.filter((result) => {
      if (result.metadata.contentType === 'note') return true
      if (result.metadata.contentType === 'library_item') {
        return attachedItemIds.includes(result.metadata.libraryItemId)
      }
      return false
    })

    console.log(`🔍 Search results: ${results.length} → ${filtered.length} (attached only)`)

    return filtered.map((r) => ({
      content: r.content,
      score: r.score,
      metadata: r.metadata,
      sourceType: r.metadata.contentType,
      sourceFile: r.metadata.sourceFile,
      author: r.metadata.author,
      title: r.metadata.title,
    }))
  }

  /**
   * Update note association when library item is moved
   */
  async updateLibraryItemNoteAssociation(
    libraryItemId: string,
    oldNoteId: string | null,
    newNoteId: string | null
  ): Promise<void> {
    const targetNoteId = await this.getTargetNoteId(libraryItemId, newNoteId)
    console.log(`🔄 Updating note association: ${oldNoteId || 'none'} → ${targetNoteId}`)

    const chunks = await VectorChunk.query()
      .where('libraryItemId', libraryItemId)
      .select('pineconeId')
    const vectorIds = chunks.map((c) => c.pineconeId).filter(Boolean)

    if (vectorIds.length > 0) {
      await this.pineconeService.updateMetadataByIds(vectorIds, { noteId: targetNoteId })
    }

    await VectorChunk.query().where('libraryItemId', libraryItemId).update({ noteId: targetNoteId })
    console.log(`✅ Updated ${vectorIds.length} vectors`)
  }

  // ========== Private Helper Methods ==========

  /**
   * Split text into chunks with overlap
   */
  private splitText(text: string, chunkSize = 1000, overlap = 200): TextChunk[] {
    const chunks: TextChunk[] = []
    let index = 0
    let chunkIndex = 0

    while (index < text.length) {
      const end = Math.min(index + chunkSize, text.length)
      chunks.push({ content: text.slice(index, end), index: chunkIndex++ })
      index += chunkSize - overlap
    }

    return chunks
  }

  /**
   * Create vector records with embeddings
   */
  private async createVectors(chunks: TextChunk[], metadata: any): Promise<VectorRecord[]> {
    const texts = chunks.map((c) => c.content)
    const embeddings = await getEmbeddings(texts)

    return chunks.map((chunk, i) => {
      const chunkId = uuidv4()
      const pineconeId = this.buildPineconeId(metadata, i)

      return {
        id: pineconeId,
        values: embeddings[i],
        metadata: {
          ...metadata,
          chunkId,
          text: chunk.content,
          chunkIndex: i,
          chunkSize: chunk.content.length,
        },
      }
    })
  }

  /**
   * Store vectors in Pinecone and database
   */
  private async storeVectors(vectors: VectorRecord[]): Promise<void> {
    await this.pineconeService.upsert(vectors)

    const dbChunks = vectors.map((v) => ({
      id: v.metadata.chunkId,
      noteId: v.metadata.noteId,
      libraryItemId: v.metadata.libraryItemId,
      userId: v.metadata.userId,
      contentType: v.metadata.contentType,
      content: v.metadata.text,
      chunkIndex: v.metadata.chunkIndex,
      chunkSize: v.metadata.chunkSize,
      pineconeId: v.id,
      vectorStatus: 'completed' as const,
      sourceFile: v.metadata.sourceFile,
      author: v.metadata.author,
      title: v.metadata.title,
    }))

    await VectorChunk.createMany(dbChunks)
  }

  /**
   * Build Pinecone ID
   */
  private buildPineconeId(metadata: any, index: number): string {
    if (metadata.contentType === 'note') {
      return `${metadata.noteId}_note_${index}`
    }
    return `${metadata.noteId}_lib_${metadata.libraryItemId}_${index}`
  }

  /**
   * Get or create note for library item
   */
  private async getNoteIdForLibraryItem(libraryItem: any): Promise<string> {
    if (libraryItem.noteId) return libraryItem.noteId

    const systemNote = await this.noteService.getOrCreateLibrarySystemNote(
      libraryItem.projectId,
      libraryItem.project.userId
    )
    return systemNote.id
  }

  /**
   * Get target note ID for association update
   */
  private async getTargetNoteId(libraryItemId: string, newNoteId: string | null): Promise<string> {
    if (newNoteId) return newNoteId

    const libraryItem = await LibraryItem.query()
      .where('id', libraryItemId)
      .preload('project')
      .firstOrFail()

    const systemNote = await this.noteService.getOrCreateLibrarySystemNote(
      libraryItem.projectId,
      libraryItem.project.userId
    )
    return systemNote.id
  }

  /**
   * Generate document summary (1-2 sentences)
   */
  private async generateSummary(chunks: TextChunk[]): Promise<string | null> {
    try {
      const sampleText = chunks
        .slice(0, 5)
        .map((c) => c.content)
        .join('\n\n')
        .slice(0, 8000)
      const openai = getOpenAIClient()

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Create a brief 1-2 sentence summary focusing on main topics.',
          },
          { role: 'user', content: `Summarize:\n\n${sampleText}` },
        ],
        max_tokens: 100,
        temperature: 0.3,
      })

      return response.choices[0].message.content?.trim() || null
    } catch (error) {
      console.error('❌ Summary generation failed:', error)
      return null
    }
  }

  /**
   * Extract author from filename or content
   */
  private extractAuthor(filename: string, content: string): string | undefined {
    const filenameMatch = filename.match(/by[_\s]+(.+?)(?:\.|_|-|$)/i)
    if (filenameMatch) return filenameMatch[1].trim()

    const patterns = [
      /(?:Author|By|Written by)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\n/m,
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) return match[1].trim()
    }
  }

  /**
   * Extract title from filename or content
   */
  private extractTitle(filename: string, content: string): string | undefined {
    const patterns = [/^#\s+(.+)$/m, /^Title[:\s]+(.+)$/im, /^(.+)\n={3,}$/m]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) return match[1].trim()
    }

    return filename.replace(/\.[^/.]+$/, '')
  }

  /**
   * Update vector status
   */
  private async updateStatus(
    type: 'note' | 'library',
    id: string,
    status: 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    const update = { vectorStatus: status, vectorUpdatedAt: DateTime.now() }
    if (type === 'note') {
      await Note.query().where('id', id).update(update)
    } else {
      await LibraryItem.query().where('id', id).update(update)
    }
  }

  /**
   * Mark vectorization as completed
   */
  private async markCompleted(
    type: 'note' | 'library',
    id: string,
    summary?: string | null
  ): Promise<void> {
    const update: any = { vectorStatus: 'completed', vectorUpdatedAt: DateTime.now() }
    if (summary) update.summary = summary

    if (type === 'note') {
      await Note.query().where('id', id).update(update)
    } else {
      await LibraryItem.query().where('id', id).update(update)
    }
  }

  /**
   * Delete note vectors
   */
  private async deleteNoteVectors(noteId: string): Promise<void> {
    const chunks = await VectorChunk.query().where('noteId', noteId).where('contentType', 'note')
    if (chunks.length > 0) {
      await this.pineconeService.deleteByIds(chunks.map((c) => c.pineconeId))
      await VectorChunk.query().where('noteId', noteId).where('contentType', 'note').delete()
    }
  }

  /**
   * Delete library item vectors
   */
  private async deleteLibraryItemVectors(libraryItemId: string): Promise<void> {
    const chunks = await VectorChunk.query().where('libraryItemId', libraryItemId)
    if (chunks.length > 0) {
      await this.pineconeService.deleteByIds(chunks.map((c) => c.pineconeId))
      await VectorChunk.query().where('libraryItemId', libraryItemId).delete()
    }
  }
}
