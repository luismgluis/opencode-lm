import { describe, test, expect } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import path from "path"
import { readFileSync, readdirSync } from "fs"

interface MigrationEntry {
  sql: string
  timestamp: number
  name: string
}

function loadMigrations(): MigrationEntry[] {
  const dir = path.join(import.meta.dirname, "../../migration")
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      sql: readFileSync(path.join(dir, entry.name, "migration.sql"), "utf-8"),
      timestamp: Number(entry.name.split("_")[0]),
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  return entries
}

function sessionColumns(sqlite: Database): string[] {
  return sqlite
    .query("PRAGMA table_info(session)")
    .all()
    .map((row) => String((row as { name?: unknown }).name))
}

describe("schema upgrade", () => {
  test("adds session.automation when upgrading existing databases", () => {
    const sqlite = new Database(":memory:")
    sqlite.exec("PRAGMA foreign_keys = ON")

    const entries = loadMigrations()
    const targetMigration = "20260429202000_add_session_automation"
    const targetIndex = entries.findIndex((entry) => entry.name === targetMigration)

    expect(targetIndex).toBeGreaterThan(-1)

    const db = drizzle({ client: sqlite })
    migrate(db, entries.slice(0, targetIndex))

    expect(sessionColumns(sqlite)).not.toContain("automation")

    migrate(db, entries)

    expect(sessionColumns(sqlite)).toContain("automation")

    sqlite.exec(`
      INSERT INTO project (id, worktree, vcs, sandboxes, time_created, time_updated)
      VALUES ('proj_upgrade_case', '/tmp/worktree', 'git', '[]', 1, 1);
    `)
    sqlite.exec(`
      INSERT INTO session (
        id, project_id, slug, directory, path, title, version, automation, time_created, time_updated
      ) VALUES (
        'ses_upgrade_case', 'proj_upgrade_case', 'upgrade-case', '/tmp/worktree', 'tmp/worktree',
        'Upgrade Session', '0.0.0-dev', '{"id":"aut_1","name":"smoke"}', 1, 1
      );
    `)

    const row = sqlite
      .query("SELECT id, automation FROM session WHERE id = 'ses_upgrade_case'")
      .get() as { id: string; automation: string | null } | null

    expect(row).not.toBeNull()
    expect(row?.id).toBe("ses_upgrade_case")
    expect(row?.automation).toContain("aut_1")

    sqlite.close()
  })
})
