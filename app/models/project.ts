import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import LibraryItem from '#models/library_Item'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Workflow from '#models/workflow'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

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

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt?: DateTime | null // Soft-delete

  @hasMany(() => Workflow)
  declare workflows: HasMany<typeof Workflow>

  @hasMany(() => LibraryItem)
  declare libraryItems: HasMany<typeof LibraryItem>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @column({ columnName: 'folder_tree', serializeAs: 'folderTree' })
  declare folderTree?: JSON
}
