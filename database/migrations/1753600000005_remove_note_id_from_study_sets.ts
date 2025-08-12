import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Remove note_id from multiple_choice_sets table since we now use many-to-many
    this.schema.alterTable('multiple_choice_sets', (table) => {
      table.dropForeign(['note_id'])
      table.dropColumn('note_id')
    })
  }

  async down() {
    // Add back note_id column if rollback is needed
    this.schema.alterTable('multiple_choice_sets', (table) => {
      table.uuid('note_id').nullable().references('id').inTable('notes').onDelete('CASCADE')
    })
  }
}
