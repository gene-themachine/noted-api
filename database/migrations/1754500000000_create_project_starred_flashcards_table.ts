import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'project_starred_flashcards'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table
        .uuid('flashcard_id')
        .notNullable()
        .references('id')
        .inTable('flashcards')
        .onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Ensure unique combination - one star per flashcard per project
      table.unique(['project_id', 'flashcard_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}