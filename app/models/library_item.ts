import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import Project from '#models/project'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

// This will be the model for files stored in the library system
export default class LibraryItem extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare projectId: string // UUID, FK → projects.id

  @column()
  declare name: string // Display name

  @column()
  declare mimeType: string // e.g. application/pdf, image/jpeg

  @column()
  declare storagePath: string // Object key in Supabase Storage / S3

  @column()
  declare size: number // Bytes

  @column()
  declare isGlobal: boolean // New flag — true ⇒ file is global

  @column.dateTime()
  declare uploadedAt: DateTime // Defaults to now()

  @column.dateTime()
  declare deletedAt?: DateTime | null // Soft-delete

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>
}
