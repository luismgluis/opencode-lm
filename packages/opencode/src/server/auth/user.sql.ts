import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../../storage/schema.sql"

export const UserTable = sqliteTable("user", {
  id: text().primaryKey(),
  username: text().notNull(),
  password_hash: text().notNull(),
  role: text({ enum: ["admin", "member"] }).notNull().$default(() => "member"),
  ...Timestamps,
}, (table) => [uniqueIndex("user_username_idx").on(table.username)])

export const AuthSessionTable = sqliteTable("auth_session", {
  id: text().primaryKey(),
  user_id: text().notNull().references(() => UserTable.id, { onDelete: "cascade" }),
  token: text().notNull(),
  expires_at: integer().notNull(),
  ...Timestamps,
})
