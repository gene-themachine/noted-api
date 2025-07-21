import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import LibraryItem from '#models/library_item'
import Flashcard from '#models/flashcard'
import StudyOptions from '#models/study_options'

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

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => LibraryItem)
  declare libraryItems: HasMany<typeof LibraryItem>

  @hasMany(() => Flashcard)
  declare flashcards: HasMany<typeof Flashcard>

  @hasOne(() => StudyOptions)
  declare studyOptions: HasOne<typeof StudyOptions>
}
