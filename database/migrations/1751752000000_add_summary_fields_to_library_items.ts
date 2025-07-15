import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'library_items'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('short_summary').nullable()
      table.text('full_summary').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('short_summary')
      table.dropColumn('full_summary')
    })
  }
}
