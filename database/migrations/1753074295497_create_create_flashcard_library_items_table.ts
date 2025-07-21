import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'flashcard_library_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('flashcard_id').references('id').inTable('flashcards').onDelete('CASCADE')
      table.uuid('library_item_id').references('id').inTable('library_items').onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['flashcard_id', 'library_item_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
