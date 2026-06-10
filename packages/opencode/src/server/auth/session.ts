import { randomBytes, createHmac } from "node:crypto"

// ── Direct SQLite connection (no drizzle dependency) ──

let _db: any = null
function getDb() {
  if (!_db) {
    const { Database } = require("bun:sqlite")
    const dbPath = "/root/.local/share/opencode/opencode-dev.db"
    console.error("=== AUTH USING DB ===", dbPath)
    _db = new Database(dbPath)
    _db.exec("PRAGMA journal_mode = WAL")
    _db.exec("PRAGMA busy_timeout = 5000")
    // Ensure custom auth tables exist
    _db.exec(`CREATE TABLE IF NOT EXISTS user (
      id TEXT NOT NULL PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')),
      time_created INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      time_updated INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    )`)
    _db.exec(`CREATE TABLE IF NOT EXISTS auth_session (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      time_created INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      time_updated INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    )`)
    _db.exec("CREATE UNIQUE INDEX IF NOT EXISTS user_username_idx ON user(username)")
    // User key-value data store (projects, preferences, settings)
    _db.exec(`CREATE TABLE IF NOT EXISTS user_data (
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '{}',
      time_updated INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
      PRIMARY KEY (user_id, key)
    )`)
  }
  return _db
}

export type User = {
  id: string
  username: string
  password_hash: string
  role: "admin" | "member"
  time_created: number
  time_updated: number
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

// ── User management (raw SQLite queries) ──

export function getUserById(id: string): User | undefined {
  return getDb().query("SELECT * FROM user WHERE id = ?").get(id)
}

export function getUserByUsername(username: string): User | undefined {
  return getDb().query("SELECT * FROM user WHERE username = ?").get(username)
}

export function getAllUsers(): Array<{ id: string; username: string; role: string; time_created: number }> {
  return getDb().query("SELECT id, username, role, time_created FROM user").all()
}

export function deleteUser(id: string) {
  getDb().run("DELETE FROM user WHERE id = ?", id)
}

export function updateUserRole(id: string, role: "admin" | "member") {
  getDb().run("UPDATE user SET role = ?, time_updated = ? WHERE id = ?", role, Date.now(), id)
}

export function countUsers(): number {
  const row = getDb().query("SELECT COUNT(*) as count FROM user").get() as { count: number } | undefined
  return row?.count ?? 0
}

export function updatePassword(id: string, passwordHash: string) {
  getDb().run("UPDATE user SET password_hash = ?, time_updated = ? WHERE id = ?", passwordHash, Date.now(), id)
}

export function createUser(username: string, passwordHash: string, role: "admin" | "member") {
  const id = randomBytes(16).toString("hex")
  getDb().run("INSERT INTO user (id, username, password_hash, role) VALUES (?, ?, ?, ?)", id, username, passwordHash, role)
  return id
}

// Session helpers

export function createSession(userId: string) {
  const user = getUserById(userId)
  if (!user) throw new Error("User not found")
  return {
    id: userId,
    token: createToken({ id: user.id, username: user.username, role: user.role }),
    user: { id: user.id, username: user.username, role: user.role },
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

// ── User data store (key-value, survives browser clears) ──

export function getUserData(userId: string, key: string): string | undefined {
  const row = getDb().query("SELECT value FROM user_data WHERE user_id = ? AND key = ?").get(userId, key) as { value: string } | undefined
  return row?.value
}

export function setUserData(userId: string, key: string, value: string) {
  getDb().run(
    `INSERT INTO user_data (user_id, key, value, time_updated) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, time_updated = excluded.time_updated`,
    userId, key, value, Date.now(),
  )
}

export function deleteUserData(userId: string, key: string) {
  getDb().run("DELETE FROM user_data WHERE user_id = ? AND key = ?", userId, key)
}
