import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'free_responses'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('rubric').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('rubric')
    })
  }
}
