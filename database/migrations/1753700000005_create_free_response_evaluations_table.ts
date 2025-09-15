import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'free_response_evaluations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('free_response_id')
        .notNullable()
        .references('id')
        .inTable('free_responses')
        .onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.text('user_answer').notNullable()
      table.integer('score').notNullable() // 0-100
      table.boolean('is_correct').notNullable()
      table.text('feedback').nullable()
      table.json('key_points').nullable() // Array of strings
      table.json('improvements').nullable() // Array of strings

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
