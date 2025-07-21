import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Note from '#models/note'
import User from './user.js'
import Project from './project.js'
import LibraryItem from './library_item.js'

export default class Flashcard extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column({ columnName: 'note_id' })
  declare noteId: string

  @column()
  declare term: string

  @column()
  declare definition: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Note)
  declare note: BelongsTo<typeof Note>

  @column({ columnName: 'using_note_content' })
  declare usingNoteContent: boolean

  @column({ columnName: 'user_id' })
  declare userId: string

  @column({ columnName: 'project_id' })
  declare projectId: string

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>

  @column({ columnName: 'needs_update' })
  declare needsUpdate: boolean

  @manyToMany(() => LibraryItem, {
    pivotTable: 'flashcard_library_items',
  })
  declare libraryItems: ManyToMany<typeof LibraryItem>
}
