import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'workflow_library_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workflow_id').references('id').inTable('workflows').onDelete('CASCADE')
      table.string('name').notNullable() // Display name
      table.string('mime_type').notNullable()
      table.string('storage_path').notNullable()
      table.bigInteger('size').notNullable()
      table.timestamp('uploaded_at').defaultTo(this.now())
      table.timestamp('deleted_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
