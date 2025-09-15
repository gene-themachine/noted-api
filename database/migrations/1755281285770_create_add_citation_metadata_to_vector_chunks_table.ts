import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vector_chunks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add citation metadata columns
      table.string('citation_key', 100).nullable()
      table.string('author', 200).nullable()
      table.string('title', 500).nullable()
      table.string('year', 4).nullable()
      table.string('document_type', 50).nullable()

      // Add indexes for better query performance
      table.index(['citation_key'])
      table.index(['author'])
      table.index(['year'])
      table.index(['document_type'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['citation_key'])
      table.dropIndex(['author'])
      table.dropIndex(['year'])
      table.dropIndex(['document_type'])

      table.dropColumn('citation_key')
      table.dropColumn('author')
      table.dropColumn('title')
      table.dropColumn('year')
      table.dropColumn('document_type')
    })
  }
}
