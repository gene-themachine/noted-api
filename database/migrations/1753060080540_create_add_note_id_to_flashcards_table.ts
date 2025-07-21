import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'flashcards'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('note_id').references('id').inTable('notes').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('note_id')
    })
  }
}
