import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Note from '#models/note'
import Flashcard from '#models/flashcard'
import User from '#models/user'
import Project from '#models/project'
import LibraryItem from './library_item.js'

export default class FlashcardSet extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare userId: string | null // UUID, FK → users.id

  @column()
  declare projectId: string | null // UUID, FK → projects.id

  @column()
  declare name: string

  @column({ columnName: 'flashcard_set_id' })
  declare flashcardSetId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @manyToMany(() => LibraryItem, {
    pivotTable: 'flashcard_set_library_items',
    pivotTimestamps: true,
  })
  declare libraryItems: ManyToMany<typeof LibraryItem>

  @manyToMany(() => Note, {
    pivotTable: 'flashcard_set_notes',
    pivotTimestamps: true,
  })
  declare notes: ManyToMany<typeof Note>

  @hasMany(() => Flashcard)
  declare flashcards: HasMany<typeof Flashcard>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>
}
