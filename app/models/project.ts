import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import LibraryItem from '#models/library_item'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import MultipleChoiceSet from './multiple_choice_set.js'
import FlashcardSet from './flashcard_set.js'
import Flashcard from './flashcard.js'
import MultipleChoiceQuestion from './multiple_choice_question.js'

// This will be the model for projects
export default class Project extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare userId: string // UUID, FK → users.id

  @column()
  declare description?: string | null //This text will change based on work progress / could contains timeline as one too
  // on work progress / could contains timeline as one too

  @column()
  declare name: string

  @column()
  declare color?: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt?: DateTime | null // Soft-delete

  @hasMany(() => LibraryItem)
  declare libraryItems: HasMany<typeof LibraryItem>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => MultipleChoiceSet)
  declare multipleChoiceSets: HasMany<typeof MultipleChoiceSet>

  @hasMany(() => FlashcardSet)
  declare flashcardSets: HasMany<typeof FlashcardSet>

  @manyToMany(() => Flashcard, {
    pivotTable: 'project_starred_flashcards',
    pivotTimestamps: true,
  })
  declare starredFlashcards: ManyToMany<typeof Flashcard>

  @manyToMany(() => MultipleChoiceQuestion, {
    pivotTable: 'project_starred_multiple_choice_questions',
    pivotTimestamps: true,
  })
  declare starredMultipleChoiceQuestions: ManyToMany<typeof MultipleChoiceQuestion>

  @column({ columnName: 'folder_tree', serializeAs: 'folderTree' })
  declare folderTree?: JSON
}
