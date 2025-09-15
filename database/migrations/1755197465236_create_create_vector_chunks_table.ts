import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vector_chunks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      // Relationships
      table.uuid('note_id').notNullable().references('id').inTable('notes').onDelete('CASCADE')
      table
        .uuid('library_item_id')
        .nullable()
        .references('id')
        .inTable('library_items')
        .onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')

      // Content metadata
      table.enum('content_type', ['note', 'library_item']).notNullable()
      table.text('content').notNullable()
      table.string('source_file').nullable()
      table.integer('page_number').nullable()

      // Chunking metadata
      table.integer('chunk_index').notNullable()
      table.integer('chunk_size').notNullable()
      table.uuid('parent_chunk_id').nullable().references('id').inTable('vector_chunks')

      // Vector metadata
      table.string('pinecone_id').unique().notNullable()
      table.string('embedding_model').notNullable().defaultTo('text-embedding-3-small')

      // Processing metadata
      table
        .enum('vector_status', ['pending', 'processing', 'completed', 'failed'])
        .defaultTo('pending')
      table.text('error_message').nullable()

      // Semantic metadata (optional)
      table.string('section_title').nullable()
      table.string('content_category').nullable()
      table.decimal('keyword_density', 8, 4).nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Indexes for efficient querying
      table.index(['note_id'])
      table.index(['library_item_id'])
      table.index(['user_id'])
      table.index(['content_type'])
      table.index(['vector_status'])
      table.index(['pinecone_id'])

      // Unique constraint for chunk ordering within a document
      table.unique(['note_id', 'library_item_id', 'chunk_index'], {
        indexName: 'unique_chunk_order_per_document',
      })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
