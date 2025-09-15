import { BaseSchema } from '@adonisjs/lucid/schema'

export default class UpdateUsersForSupabase extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    // Use raw SQL for IF EXISTS/IF NOT EXISTS so repeated runs are safe
    await this.schema.raw('ALTER TABLE "users" DROP COLUMN IF EXISTS "password"')
    await this.schema.raw(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supabase_uid" varchar(255)'
    )
    await this.schema.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS users_supabase_uid_unique ON "users" ("supabase_uid")'
    )
    await this.schema.raw('ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL')

    // Drop auth_access_tokens if present
    await this.schema.dropTableIfExists('auth_access_tokens')
  }

  public async down() {
    await this.schema.raw('ALTER TABLE "users" DROP COLUMN IF EXISTS "supabase_uid"')
    // Optionally re-add NOT NULL to email if needed (commented to avoid data issues)
    // await this.schema.raw('ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL')
    // Recreate password column (nullable) for rollback
    await this.schema.raw('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" varchar(255)')
  }
}
