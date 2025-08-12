import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import MultipleChoiceSet from '#models/multiple_choice_set'

export default class MultipleChoiceQuestion extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare multipleChoiceSetId: string // UUID, FK → multiple_choice_sets.id

  @column()
  declare question: string

  @column()
  declare answer: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => MultipleChoiceSet)
  declare multipleChoiceSet: BelongsTo<typeof MultipleChoiceSet>
}
