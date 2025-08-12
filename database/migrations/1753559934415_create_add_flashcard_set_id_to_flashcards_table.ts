import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'flashcards'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .uuid('flashcard_set_id')
        .nullable()
        .references('id')
        .inTable('flashcard_sets')
        .onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('flashcard_set_id')
    })
  }
}
