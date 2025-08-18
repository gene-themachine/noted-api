import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'note_library_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      
      // Foreign key to notes table
      table.uuid('note_id').notNullable().references('id').inTable('notes').onDelete('CASCADE')
      
      // Foreign key to library_items table  
      table.uuid('library_item_id').notNullable().references('id').inTable('library_items').onDelete('CASCADE')

      // Ensure unique combinations
      table.unique(['note_id', 'library_item_id'])

      // Indexes for better performance
      table.index(['note_id'])
      table.index(['library_item_id'])

      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}