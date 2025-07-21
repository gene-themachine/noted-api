import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'library_items'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('flashcard_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .uuid('flashcard_id')
        .nullable()
        .references('id')
        .inTable('flashcards')
        .onDelete('SET NULL')
    })
  }
}
