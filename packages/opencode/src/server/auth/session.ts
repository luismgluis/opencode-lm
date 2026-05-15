import { randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import { Database } from "../../storage/db"
import { AuthSessionTable, UserTable } from "./user.sql"

const SESSION_TOKEN_BYTES = 48
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export type User = {
  id: string
  username: string
  role: "admin" | "member"
}

export type Session = {
  id: string
  token: string
  user: User
  expiresAt: number
}

function generateToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("hex")
}

export function createSession(userId: string): Session {
  const token = generateToken()
  const id = randomBytes(16).toString("hex")
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS

  Database.transaction((tx) => {
    tx.insert(AuthSessionTable).values({ id, user_id: userId, token, expires_at: expiresAt }).run()
  })

  const user = Database.use((tx) =>
    tx.select().from(UserTable).where(eq(UserTable.id, userId)).get()
  )

  return {
    id,
    token,
    user: { id: user!.id, username: user!.username, role: user!.role as "admin" | "member" },
    expiresAt,
  }
}

export function getSessionByToken(token: string): Session | null {
  const row = Database.use((tx) =>
    tx.select().from(AuthSessionTable).where(eq(AuthSessionTable.token, token)).get()
  )
  if (!row) return null
  if (row.expires_at < Date.now()) {
    Database.transaction((tx) => tx.delete(AuthSessionTable).where(eq(AuthSessionTable.id, row.id)).run())
    return null
  }
  const user = Database.use((tx) =>
    tx.select().from(UserTable).where(eq(UserTable.id, row.user_id)).get()
  )
  if (!user) return null
  return {
    id: row.id,
    token: row.token,
    user: { id: user.id, username: user.username, role: user.role as "admin" | "member" },
    expiresAt: row.expires_at,
  }
}

export function deleteSession(token: string) {
  Database.transaction((tx) => tx.delete(AuthSessionTable).where(eq(AuthSessionTable.token, token)).run())
}

export function getUserById(id: string) {
  return Database.use((tx) =>
    tx.select().from(UserTable).where(eq(UserTable.id, id)).get()
  )
}

export function getUserByUsername(username: string) {
  return Database.use((tx) =>
    tx.select().from(UserTable).where(eq(UserTable.username, username)).get()
  )
}

export function getAllUsers() {
  return Database.use((tx) =>
    tx.select({ id: UserTable.id, username: UserTable.username, role: UserTable.role, time_created: UserTable.time_created }).from(UserTable).all()
  )
}

export function deleteUser(id: string) {
  Database.transaction((tx) => tx.delete(UserTable).where(eq(UserTable.id, id)).run())
}

export function updateUserRole(id: string, role: "admin" | "member") {
  Database.transaction((tx) =>
    tx.update(UserTable).set({ role }).where(eq(UserTable.id, id)).run()
  )
}

export function countUsers(): number {
  return Database.use((tx) => tx.select().from(UserTable).all()).length
}

export function updatePassword(id: string, passwordHash: string) {
  Database.transaction((tx) =>
    tx.update(UserTable).set({ password_hash: passwordHash }).where(eq(UserTable.id, id)).run()
  )
}
