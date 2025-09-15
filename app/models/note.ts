import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, beforeSave, afterSave } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import LibraryItem from '#models/library_item'
import NativeVectorService from '#services/native_vector_service'

export default class Note extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare userId: string | null // UUID, FK → users.id

  @column()
  declare projectId: string | null // UUID, FK → projects.id

  @column()
  declare name: string

  @column()
  declare content: string

  @column()
  declare vectorStatus: 'pending' | 'processing' | 'completed' | 'failed'

  @column.dateTime()
  declare vectorUpdatedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => LibraryItem)
  declare libraryItems: HasMany<typeof LibraryItem>

  // Track content changes for vectorization
  private contentChanged: boolean = false

  @beforeSave()
  static async checkContentChanges(note: Note) {
    if (note.$dirty.content && note.content?.trim()) {
      // Mark that content has changed and needs vectorization
      note.contentChanged = true
      note.vectorStatus = 'pending'
      note.vectorUpdatedAt = DateTime.now()
    }
  }

  @afterSave()
  static async processVectorization(note: Note) {
    // Only vectorize if content changed and note has content
    if (note.contentChanged && note.content?.trim() && note.userId) {
      try {
        const vectorService = new NativeVectorService()

        // Process vectorization asynchronously (fire and forget)
        setImmediate(async () => {
          try {
            await vectorService.vectorizeNote(note.id)
          } catch (error) {
            console.error(`❌ Note vectorization failed: ${error.message}`)
          }
        })

        console.log(`🔄 Starting immediate vectorization for note ${note.id}`)
      } catch (error) {
        console.error(`❌ Note vectorization failed: ${error.message}`)
      }
    }
  }

  // Helper methods
  get isVectorized(): boolean {
    return this.vectorStatus === 'completed'
  }

  get needsVectorization(): boolean {
    return (
      this.vectorStatus === 'pending' ||
      this.vectorStatus === 'failed' ||
      (this.vectorUpdatedAt ? this.updatedAt > this.vectorUpdatedAt : true)
    )
  }
}
