import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'free_response_evaluations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('criteria_scores').nullable()
      table.text('overall_feedback').nullable()
      table.json('key_strengths').nullable()
      table.json('areas_for_improvement').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('criteria_scores')
      table.dropColumn('overall_feedback')
      table.dropColumn('key_strengths')
      table.dropColumn('areas_for_improvement')
    })
  }
}
