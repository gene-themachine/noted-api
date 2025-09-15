import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Add vector status to notes table
    this.schema.alterTable('notes', (table) => {
      table
        .enum('vector_status', ['pending', 'processing', 'completed', 'failed'])
        .defaultTo('pending')
      table.timestamp('vector_updated_at').nullable()
    })

    // Add vector status to library_items table
    this.schema.alterTable('library_items', (table) => {
      table
        .enum('vector_status', ['pending', 'processing', 'completed', 'failed'])
        .defaultTo('pending')
      table.timestamp('vector_updated_at').nullable()
    })
  }

  async down() {
    // Remove vector status from notes table
    this.schema.alterTable('notes', (table) => {
      table.dropColumn('vector_status')
      table.dropColumn('vector_updated_at')
    })

    // Remove vector status from library_items table
    this.schema.alterTable('library_items', (table) => {
      table.dropColumn('vector_status')
      table.dropColumn('vector_updated_at')
    })
  }
}
