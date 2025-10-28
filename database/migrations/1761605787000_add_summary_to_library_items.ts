import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'library_items'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add summary column for intent classification
      table.text('summary').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('summary')
    })
  }
}
