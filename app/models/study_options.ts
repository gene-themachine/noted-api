import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Note from '#models/note'

export default class StudyOptions extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column({ columnName: 'note_id' })
  declare noteId: string // UUID, FK → notes.id

  @column()
  declare flashcard: boolean

  @column({ columnName: 'blurt_it_out' })
  declare blurtItOut: boolean

  @column({ columnName: 'multiple_choice' })
  declare multipleChoice: boolean

  @column({ columnName: 'fill_in_the_blank' })
  declare fillInTheBlank: boolean

  @column()
  declare matching: boolean

  @column({ columnName: 'short_answer' })
  declare shortAnswer: boolean

  @column()
  declare essay: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => Note)
  declare note: BelongsTo<typeof Note>
}
