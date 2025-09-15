import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'project_starred_multiple_choice_questions'

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
        .uuid('multiple_choice_question_id')
        .notNullable()
        .references('id')
        .inTable('multiple_choice_questions')
        .onDelete('CASCADE')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Ensure unique combination - one star per question per project
      table.unique(['project_id', 'multiple_choice_question_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
