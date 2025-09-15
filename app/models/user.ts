import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Project from '#models/project'
import Todo from '#models/todo'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // UUID, PK

  @column({ columnName: 'supabase_uid' })
  declare supabaseUid: string

  @column()
  declare firstName: string | null

  @column()
  declare username: string | null

  @column()
  declare email: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => Project)
  declare projects: HasMany<typeof Project>

  @hasMany(() => Todo)
  declare todos: HasMany<typeof Todo>
}
