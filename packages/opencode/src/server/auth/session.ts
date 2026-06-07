import { randomBytes, createHmac } from "node:crypto"
import { eq } from "drizzle-orm"
import { drizzle, type SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { AuthSessionTable, UserTable } from "./user.sql"
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core"

// Direct SQLite connection — independent of Effect-based Database service
const dbPath = process.env.OPENCODE_STORAGE_PATH
  ? `${process.env.OPENCODE_STORAGE_PATH}/opencode.db`
  : (() => {
      const flag = process.env.OPENCODE_DB
      if (flag) {
        if (flag === ":memory:" || flag.startsWith("/")) return flag
        return `${process.env.HOME || "/root"}/.local/share/opencode/${flag}`
      }
      return `${process.env.HOME || "/root"}/.local/share/opencode/opencode-dev.db`
    })()

let _client: BunSQLiteDatabase | null = null
function getClient(): BunSQLiteDatabase {
  if (!_client) {
    const sqlite = new Database(dbPath)
    sqlite.exec("PRAGMA journal_mode = WAL")
    sqlite.exec("PRAGMA busy_timeout = 5000")
    _client = drizzle(sqlite)
  }
  return _client
}

type TxOrDb = BunSQLiteDatabase | SQLiteTransaction<"sync", void>

function tx<T>(callback: (tx: TxOrDb) => T): T {
  const client = getClient()
  try {
    return callback(client)
  } catch {
    // Fallback: let caller handle
    return callback(client)
  }
}

export type User = {
  id: string
  username: string
  role: "admin" | "member"
}

export type TokenPayload = {
  sub: string
  username: string
  role: "admin" | "member"
  iat: number
  exp: number
}

const JWT_SECRET = process.env.OPENCODE_SERVER_PASSWORD || "opencode-jwt-secret-change-me"
const JWT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function base64url(buf: Buffer): string {
  return buf.toString("base64url")
}

function base64urlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url")
}

function sign(payload: object): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })))
  const body = base64url(Buffer.from(JSON.stringify(payload)))
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
  return `${header}.${body}.${base64url(signature)}`
}

function verify(token: string): TokenPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const [headerB64, bodyB64, sigB64] = parts
    const expectedSig = createHmac("sha256", JWT_SECRET)
      .update(`${headerB64}.${bodyB64}`)
      .digest()
    if (!Buffer.from(expectedSig).equals(base64urlDecode(sigB64))) return null

    const payload = JSON.parse(base64urlDecode(bodyB64).toString("utf8")) as TokenPayload
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function createToken(user: { id: string; username: string; role: string }): string {
  const now = Math.floor(Date.now() / 1000)
  return sign({
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + Math.floor(JWT_MAX_AGE_MS / 1000),
  })
}

export function verifyToken(token: string): TokenPayload | null {
  return verify(token)
}

export { sign, verify as verifyRaw }

// ── User management ──

export function getUserById(id: string) {
  return tx((db) =>
    db.select().from(UserTable).where(eq(UserTable.id, id)).get()
  )
}

export function getUserByUsername(username: string) {
  return tx((db) =>
    db.select().from(UserTable).where(eq(UserTable.username, username)).get()
  )
}

export function getAllUsers() {
  return tx((db) =>
    db.select({ id: UserTable.id, username: UserTable.username, role: UserTable.role, time_created: UserTable.time_created }).from(UserTable).all()
  )
}

export function deleteUser(id: string) {
  tx((db) => db.delete(UserTable).where(eq(UserTable.id, id)).run())
}

export function updateUserRole(id: string, role: "admin" | "member") {
  tx((db) =>
    db.update(UserTable).set({ role }).where(eq(UserTable.id, id)).run()
  )
}

export function countUsers(): number {
  return tx((db) => db.select().from(UserTable).all()).length
}

export function updatePassword(id: string, passwordHash: string) {
  tx((db) =>
    db.update(UserTable).set({ password_hash: passwordHash }).where(eq(UserTable.id, id)).run()
  )
}

export function createUser(username: string, passwordHash: string, role: "admin" | "member") {
  const id = randomBytes(16).toString("hex")
  tx((db) =>
    db.insert(UserTable).values({ id, username, password_hash: passwordHash, role }).run()
  )
  return id
}

// Keep createSession/getSessionByToken for backward compat during migration
export function createSession(userId: string) {
  const user = getUserById(userId)
  if (!user) throw new Error("User not found")
  return {
    id: userId,
    token: createToken({ id: user.id, username: user.username, role: user.role }),
    user: { id: user.id, username: user.username, role: user.role as "admin" | "member" },
    expiresAt: Date.now() + JWT_MAX_AGE_MS,
  }
}

export function getSessionByToken(token: string) {
  const payload = verifyToken(token)
  if (!payload) return null
  return {
    id: payload.sub,
    token,
    user: { id: payload.sub, username: payload.username, role: payload.role },
    expiresAt: payload.exp * 1000,
  }
}

export function deleteSession(_token: string) {
  // JWT is stateless — no server-side cleanup needed
}
