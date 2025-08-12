import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'flashcard_sets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('flashcard_set_id').nullable()
      table.index(['flashcard_set_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['flashcard_set_id'])
      table.dropColumn('flashcard_set_id')
    })
  }
}
