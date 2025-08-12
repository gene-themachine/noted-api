import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Project from '#models/project'

export default class Notification extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column({ columnName: 'user_id' })
  declare userId: string // UUID, FK → users.id

  @column({ columnName: 'project_id' })
  declare projectId: string // UUID, FK → projects.id

  @column()
  declare type: 'flashcard_generation' | 'multiple_choice_generation'

  @column()
  declare title: string

  @column()
  declare message: string

  @column()
  declare status: 'queued' | 'completed' | 'failed'

  @column()
  declare progress: number // 0-100

  @column({ columnName: 'study_set_id' })
  declare studySetId: string | null // Reference to created study set

  @column({ columnName: 'study_set_name' })
  declare studySetName: string

  @column({ columnName: 'error_message' })
  declare errorMessage: string | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>
}
