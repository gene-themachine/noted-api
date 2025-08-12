import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'todos'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('title', 255).notNullable()
      table.text('description').nullable()
      table.boolean('is_completed').defaultTo(false)
      table.timestamp('due_date').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Add indexes
      table.index(['user_id', 'is_completed'])
      table.index(['user_id', 'due_date'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
