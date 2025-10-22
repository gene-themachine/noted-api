import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.dropTableIfExists(this.tableName)
  }

  async down() {
    // No down migration - this is a cleanup migration
    // If you need to recreate the table, refer to the original migration
  }
}
