import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import FreeResponseSet from '#models/free_response_set'

export default class FreeResponse extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare freeResponseSetId: string // UUID, FK � free_response_sets.id

  @column()
  declare question: string

  @column()
  declare answer: string

  @column({
    serialize: (value) => {
      if (!value || value === '') return []
      if (typeof value === 'string') return JSON.parse(value)
      return value
    },
    prepare: (value) => JSON.stringify(value || []),
  })
  declare rubric: Array<{
    criterion: string
    points: number
  }>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => FreeResponseSet)
  declare freeResponseSet: BelongsTo<typeof FreeResponseSet>
}
