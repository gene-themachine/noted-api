import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vector_chunks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Extend varchar fields that commonly exceed 200 characters
      table.string('source_file', 500).nullable().alter() // File paths can be long
      table.string('section_title', 500).nullable().alter() // Section headers can be long
      table.string('content_category', 300).nullable().alter() // Category names
      table.string('citation_key', 200).nullable().alter() // Citation keys (keep reasonable)
      table.string('author', 500).nullable().alter() // Author names (multiple authors)
      table.string('title', 1000).nullable().alter() // Document titles (most problematic)
      table.string('document_type', 100).nullable().alter() // Document types (shorter is fine)
      table.string('embedding_model', 200).notNullable().defaultTo('text-embedding-3-small').alter() // Model names
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Revert to original constraints (though this might cause data loss if values exceed limits)
      table.string('source_file').nullable().alter()
      table.string('section_title').nullable().alter() 
      table.string('content_category').nullable().alter()
      table.string('citation_key').nullable().alter()
      table.string('author').nullable().alter()
      table.string('title').nullable().alter()
      table.string('document_type').nullable().alter()
      table.string('embedding_model').notNullable().defaultTo('text-embedding-3-small').alter()
    })
  }
}