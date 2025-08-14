import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import FreeResponse from '#models/free_response'
import User from '#models/user'

export default class FreeResponseEvaluation extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare freeResponseId: string // UUID, FK → free_responses.id

  @column()
  declare userId: string // UUID, FK → users.id

  @column()
  declare userAnswer: string

  @column()
  declare score: number // 0-100

  @column()
  declare isCorrect: boolean

  @column()
  declare feedback: string | null

  @column({
    serialize: (value) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return []
        }
      }
      return value || []
    },
  })
  declare keyPoints: string[]

  @column({
    serialize: (value) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return []
        }
      }
      return value || []
    },
  })
  declare improvements: string[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => FreeResponse)
  declare freeResponse: BelongsTo<typeof FreeResponse>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}