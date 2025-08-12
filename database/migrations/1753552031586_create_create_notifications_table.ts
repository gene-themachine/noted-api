import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table
        .string('type')
        .notNullable()
        .checkIn(['flashcard_generation', 'multiple_choice_generation'])
      table.string('title').notNullable()
      table.text('message').notNullable()
      table
        .string('status')
        .notNullable()
        .defaultTo('queued')
        .checkIn(['queued', 'completed', 'failed'])
      table.integer('progress').notNullable().defaultTo(0).checkBetween([0, 100])
      table.string('study_set_id').nullable()
      table.string('study_set_name').notNullable()
      table.text('error_message').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['user_id', 'project_id'])
      table.index('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
