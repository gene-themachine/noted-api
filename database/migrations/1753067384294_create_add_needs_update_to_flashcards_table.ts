import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'flashcards'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('needs_update').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('needs_update')
    })
  }
}
