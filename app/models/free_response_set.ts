import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import FreeResponse from '#models/free_response'
import Note from '#models/note'
import Project from '#models/project'
import User from '#models/user'
import LibraryItem from './library_item.js'

export default class FreeResponseSet extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column()
  declare userId: string | null // UUID, FK � users.id

  @column()
  declare projectId: string | null // UUID, FK � projects.id

  @column()
  declare name: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => FreeResponse)
  declare freeResponses: HasMany<typeof FreeResponse>

  @manyToMany(() => LibraryItem, {
    pivotTable: 'free_response_set_library_items',
    pivotTimestamps: true,
  })
  declare libraryItems: ManyToMany<typeof LibraryItem>

  @manyToMany(() => Note, {
    pivotTable: 'free_response_set_notes',
    pivotTimestamps: true,
  })
  declare notes: ManyToMany<typeof Note>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Project)
  declare project: BelongsTo<typeof Project>
}
