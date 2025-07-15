import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'library_items'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('processing_status').defaultTo('queued').notNullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('processing_status')
    })
  }
}
