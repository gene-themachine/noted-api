import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Update flashcard_set_library_items table
    this.schema.alterTable('flashcard_set_library_items', (table) => {
      table.timestamp('created_at').defaultTo(this.now()).alter()
      table.timestamp('updated_at').defaultTo(this.now()).alter()
    })

    // Update flashcard_set_notes table
    this.schema.alterTable('flashcard_set_notes', (table) => {
      table.timestamp('created_at').defaultTo(this.now()).alter()
      table.timestamp('updated_at').defaultTo(this.now()).alter()
    })

    // Update multiple_choice_set_library_items table
    this.schema.alterTable('multiple_choice_set_library_items', (table) => {
      table.timestamp('created_at').defaultTo(this.now()).alter()
      table.timestamp('updated_at').defaultTo(this.now()).alter()
    })

    // Update multiple_choice_set_notes table
    this.schema.alterTable('multiple_choice_set_notes', (table) => {
      table.timestamp('created_at').defaultTo(this.now()).alter()
      table.timestamp('updated_at').defaultTo(this.now()).alter()
    })
  }

  async down() {
    // Revert timestamp columns back to not null without default
    this.schema.alterTable('flashcard_set_library_items', (table) => {
      table.timestamp('created_at').notNullable().alter()
      table.timestamp('updated_at').notNullable().alter()
    })

    this.schema.alterTable('flashcard_set_notes', (table) => {
      table.timestamp('created_at').notNullable().alter()
      table.timestamp('updated_at').notNullable().alter()
    })

    this.schema.alterTable('multiple_choice_set_library_items', (table) => {
      table.timestamp('created_at').notNullable().alter()
      table.timestamp('updated_at').notNullable().alter()
    })

    this.schema.alterTable('multiple_choice_set_notes', (table) => {
      table.timestamp('created_at').notNullable().alter()
      table.timestamp('updated_at').notNullable().alter()
    })
  }
}
