import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'free_response_set_library_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('free_response_set_id').notNullable().references('id').inTable('free_response_sets').onDelete('CASCADE')
      table.uuid('library_item_id').notNullable().references('id').inTable('library_items').onDelete('CASCADE')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['free_response_set_id', 'library_item_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}