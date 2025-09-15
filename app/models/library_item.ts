import { DateTime } from 'luxon'
import {
  BaseModel,
  column,
  belongsTo,
  manyToMany,
  afterSave,
  beforeSave,
} from '@adonisjs/lucid/orm'
import Project from '#models/project'
import Note from '#models/note'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Flashcard from './flashcard.js'
import NativeVectorService from '#services/native_vector_service'

// This will be the model for files stored in the library system
export default class LibraryItem extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare projectId: string // UUID, FK → projects.id

  @column()
  declare noteId: string | null // UUID, FK → notes.id

  @column()
  declare name: string // Display name

  @column()
  declare mimeType: string // e.g. application/pdf, image/jpeg

  @column()
  declare storagePath: string // Object key in Supabase Storage / S3

  @column()
  declare size: number // Bytes

  @column()
  declare isGlobal: boolean // New flag — true ⇒ file is global

  @column()
  declare processingStatus: string // Processing status

  @column()
  declare vectorStatus: 'pending' | 'processing' | 'completed' | 'failed'

  @column.dateTime()
  declare vectorUpdatedAt: DateTime | null

  @column.dateTime()
  declare uploadedAt: DateTime // Defaults to now()

  @column.dateTime()
  declare deletedAt?: DateTime | null // Soft-delete

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>

  @belongsTo(() => Note)
  declare note: BelongsTo<typeof Note>

  @manyToMany(() => Note, {
    pivotTable: 'note_library_items',
  })
  declare notes: ManyToMany<typeof Note>

  @manyToMany(() => Flashcard, {
    pivotTable: 'flashcard_library_items',
  })
  declare flashcards: ManyToMany<typeof Flashcard>

  // Track file changes for vectorization
  private fileChanged: boolean = false

  // Track note association changes for metadata updates
  private noteAssociationChanged: boolean = false
  private oldNoteId: string | null = null

  @beforeSave()
  static async checkFileChanges(libraryItem: LibraryItem) {
    // Check if file-related fields changed (excluding noteId - association changes don't require re-vectorization)
    if (
      libraryItem.$dirty.storagePath ||
      libraryItem.$dirty.name ||
      libraryItem.$dirty.mimeType ||
      libraryItem.$isNew
    ) {
      libraryItem.fileChanged = true
      libraryItem.vectorStatus = 'pending'
      libraryItem.vectorUpdatedAt = DateTime.now()
    }

    // Track note association changes for metadata updates
    if (libraryItem.$dirty.noteId && !libraryItem.$isNew) {
      libraryItem.noteAssociationChanged = true
      libraryItem.oldNoteId = libraryItem.$original.noteId
    }
  }

  @afterSave()
  static async processVectorization(libraryItem: LibraryItem) {
    // Vectorize immediately upon upload if file changed and is processable
    // No longer require noteId - process all uploaded files
    if (libraryItem.fileChanged && libraryItem.isProcessableFile()) {
      try {
        const vectorService = new NativeVectorService()

        // Process vectorization asynchronously (fire and forget)
        setImmediate(async () => {
          try {
            await vectorService.vectorizeLibraryItem(libraryItem.id)
          } catch (error) {
            console.error(`❌ Library item vectorization failed: ${error.message}`)
          }
        })

        console.log(`🔄 Starting immediate vectorization for library item ${libraryItem.id}`)
      } catch (error) {
        console.error(`❌ Library item vectorization failed: ${error.message}`)
      }
    }

    // Handle note association changes - update vector metadata
    if (libraryItem.noteAssociationChanged) {
      try {
        const vectorService = new NativeVectorService()

        // Update metadata asynchronously (fire and forget)
        setImmediate(async () => {
          try {
            await vectorService.updateLibraryItemNoteAssociation(
              libraryItem.id,
              libraryItem.oldNoteId,
              libraryItem.noteId
            )
          } catch (error) {
            console.error(`❌ Library item metadata update failed: ${error.message}`)
          }
        })

        console.log(
          `🔄 Starting metadata update for library item ${libraryItem.id} (note association change)`
        )
      } catch (error) {
        console.error(`❌ Library item metadata update failed: ${error.message}`)
      }
    }
  }

  // Helper methods
  isProcessableFile(): boolean {
    // Only process PDF files for now
    return this.mimeType === 'application/pdf'
  }

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
