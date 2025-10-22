import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Drop workflow_library_items first (has foreign key to workflows)
    this.schema.dropTableIfExists('workflow_library_items')
    // Then drop workflows table
    this.schema.dropTableIfExists('workflows')
  }

  async down() {
    // No down migration - this is a cleanup migration
    // If you need to recreate the tables, refer to the original migrations
  }
}
