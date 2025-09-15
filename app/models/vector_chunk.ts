import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Note from './note.js'
import LibraryItem from './library_item.js'
import User from './user.js'

export default class VectorChunk extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare noteId: string

  @column()
  declare libraryItemId: string | null

  @column()
  declare userId: string

  @column()
  declare contentType: 'note' | 'library_item'

  @column()
  declare content: string

  @column()
  declare sourceFile: string | null

  @column()
  declare pageNumber: number | null

  @column()
  declare chunkIndex: number

  @column()
  declare chunkSize: number

  @column()
  declare parentChunkId: string | null

  @column()
  declare pineconeId: string

  @column()
  declare embeddingModel: string

  @column()
  declare vectorStatus: 'pending' | 'processing' | 'completed' | 'failed'

  @column()
  declare errorMessage: string | null

  @column()
  declare sectionTitle: string | null

  @column()
  declare contentCategory: string | null

  @column()
  declare keywordDensity: number | null

  // Citation metadata
  @column()
  declare citationKey: string | null

  @column()
  declare author: string | null

  @column()
  declare title: string | null

  @column()
  declare year: string | null

  @column()
  declare documentType: string | null

  @column()
  declare pageStart: number | null

  @column()
  declare pageEnd: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Note)
  declare note: BelongsTo<typeof Note>

  @belongsTo(() => LibraryItem)
  declare libraryItem: BelongsTo<typeof LibraryItem>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => VectorChunk, {
    foreignKey: 'parentChunkId',
  })
  declare parentChunk: BelongsTo<typeof VectorChunk>

  // Static methods for querying
  static async findByNote(noteId: string) {
    return this.query().where('noteId', noteId)
  }

  static async findByLibraryItem(libraryItemId: string) {
    return this.query().where('libraryItemId', libraryItemId)
  }

  static async findByStatus(status: 'pending' | 'processing' | 'completed' | 'failed') {
    return this.query().where('vectorStatus', status)
  }

  static async findPendingForProcessing() {
    return this.query().where('vectorStatus', 'pending').orderBy('createdAt', 'asc')
  }

  // Instance methods
  async markAsProcessing() {
    this.vectorStatus = 'processing'
    this.updatedAt = DateTime.now()
    await this.save()
  }

  async markAsCompleted() {
    this.vectorStatus = 'completed'
    this.errorMessage = null
    this.updatedAt = DateTime.now()
    await this.save()
  }

  async markAsFailed(errorMessage: string) {
    this.vectorStatus = 'failed'
    this.errorMessage = errorMessage
    this.updatedAt = DateTime.now()
    await this.save()
  }

  // Helper methods
  get isCompleted(): boolean {
    return this.vectorStatus === 'completed'
  }

  get isFailed(): boolean {
    return this.vectorStatus === 'failed'
  }

  get isPending(): boolean {
    return this.vectorStatus === 'pending'
  }

  get isProcessing(): boolean {
    return this.vectorStatus === 'processing'
  }
}
