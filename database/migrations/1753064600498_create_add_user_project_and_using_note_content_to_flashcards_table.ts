import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'flashcards'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE')
      table.boolean('using_note_content').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('user_id')
      table.dropColumn('project_id')
      table.dropColumn('using_note_content')
    })
  }
}
