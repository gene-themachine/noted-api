import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'flashcard_set_notes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('flashcard_set_id')
        .notNullable()
        .references('id')
        .inTable('flashcard_sets')
        .onDelete('CASCADE')
      table.uuid('note_id').notNullable().references('id').inTable('notes').onDelete('CASCADE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Ensure unique combination
      table.unique(['flashcard_set_id', 'note_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
