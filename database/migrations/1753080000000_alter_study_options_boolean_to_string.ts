import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'study_options'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the existing boolean columns and recreate as string columns
      table.dropColumn('flashcard')
      table.dropColumn('blurt_it_out')
      table.dropColumn('multiple_choice')
      table.dropColumn('fill_in_the_blank')
      table.dropColumn('matching')
      table.dropColumn('short_answer')
      table.dropColumn('essay')
    })

    this.schema.alterTable(this.tableName, (table) => {
      // Add the new string columns with check constraints for valid values
      table.string('flashcard').nullable().checkIn(['queued', 'completed', 'failed'])
      table.string('blurt_it_out').nullable().checkIn(['queued', 'completed', 'failed'])
      table.string('multiple_choice').nullable().checkIn(['queued', 'completed', 'failed'])
      table.string('fill_in_the_blank').nullable().checkIn(['queued', 'completed', 'failed'])
      table.string('matching').nullable().checkIn(['queued', 'completed', 'failed'])
      table.string('short_answer').nullable().checkIn(['queued', 'completed', 'failed'])
      table.string('essay').nullable().checkIn(['queued', 'completed', 'failed'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the string columns
      table.dropColumn('flashcard')
      table.dropColumn('blurt_it_out')
      table.dropColumn('multiple_choice')
      table.dropColumn('fill_in_the_blank')
      table.dropColumn('matching')
      table.dropColumn('short_answer')
      table.dropColumn('essay')
    })

    this.schema.alterTable(this.tableName, (table) => {
      // Recreate the original boolean columns
      table.boolean('flashcard').defaultTo(false)
      table.boolean('blurt_it_out').defaultTo(false)
      table.boolean('multiple_choice').defaultTo(false)
      table.boolean('fill_in_the_blank').defaultTo(false)
      table.boolean('matching').defaultTo(false)
      table.boolean('short_answer').defaultTo(false)
      table.boolean('essay').defaultTo(false)
    })
  }
}
