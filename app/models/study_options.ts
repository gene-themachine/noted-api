import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Note from '#models/note'

// These strings are used to track the status of the study options for a note
// There are four possible values:
// null, queued, completed, failed
export default class StudyOptions extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column({ columnName: 'note_id' })
  declare noteId: string // UUID, FK → notes.id

  @column()
  declare flashcard: string | null

  @column({ columnName: 'blurt_it_out' })
  declare blurtItOut: string | null

  @column({ columnName: 'multiple_choice' })
  declare multipleChoice: string | null

  @column({ columnName: 'fill_in_the_blank' })
  declare fillInTheBlank: string | null

  @column()
  declare matching: string | null

  @column({ columnName: 'short_answer' })
  declare shortAnswer: string | null

  @column()
  declare essay: string | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => Note)
  declare note: BelongsTo<typeof Note>
}
