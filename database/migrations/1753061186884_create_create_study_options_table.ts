import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'study_options'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('note_id').references('id').inTable('notes').onDelete('CASCADE').notNullable()

      table.boolean('flashcard').defaultTo(false)
      table.boolean('blurt_it_out').defaultTo(false)
      table.boolean('multiple_choice').defaultTo(false)
      table.boolean('fill_in_the_blank').defaultTo(false)
      table.boolean('matching').defaultTo(false)
      table.boolean('short_answer').defaultTo(false)
      table.boolean('essay').defaultTo(false)

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
