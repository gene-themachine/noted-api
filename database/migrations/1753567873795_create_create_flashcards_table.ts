import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'flashcards'

  async up() {
    this.schema.createTableIfNotExists(this.tableName, (table) => {
      table.uuid('id').primary().notNullable()
      table.text('term').notNullable()
      table.text('definition').notNullable()
      table.timestamp('created_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      // Foreign key columns (these may be added by other migrations)
      table.uuid('flashcard_set_id').nullable()
      table.uuid('note_id').nullable()
      table.uuid('user_id').nullable()
      table.uuid('project_id').nullable()

      // Boolean columns with defaults
      table.boolean('using_note_content').defaultTo(false)
      table.boolean('needs_update').defaultTo(false)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
