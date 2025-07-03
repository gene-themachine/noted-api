import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import WorkflowLibraryItem from '#models/workflow_library_item'
import Project from '#models/project'

// This will be the model for workflow sessions
export default class Workflow extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare projectId: string // UUID, FK → projects.id

  @column()
  declare name: string // "Workflow #1 – Ideation and flows design"

  @column.dateTime()
  declare startedAt: DateTime // When recording began

  @column.dateTime()
  declare endedAt?: DateTime | null // When user hit "stop" (NULL ⇒ still live)

  @column()
  declare summary: string // The paragraph you show in the UI

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => WorkflowLibraryItem)
  declare workflowLibraryItems: HasMany<typeof WorkflowLibraryItem>

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>
}
