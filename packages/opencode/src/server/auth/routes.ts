import { Hono } from "hono"
import { randomBytes } from "node:crypto"
import { hashPassword, verifyPassword } from "./hash"
import {
  countUsers,
  createToken,
  verifyToken,
  getUserByUsername,
  updateUserRole,
  deleteUser,
  getAllUsers,
  getUserById,
  updatePassword,
} from "./session"
import { Database } from "@opencode-ai/core/database/database"
import { UserTable } from "./user.sql"

// ── JWT Auth Middleware for Hono ──
function jwtAuth() {
  return async (c: any, next: any) => {
    const authHeader = c.req.header("authorization") || ""
    const cookieHeader = c.req.header("cookie") || ""

    let token: string | undefined

    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7)
    } else {
      const match = cookieHeader.match(/opencode_session=([^;]+)/)
      token = match?.[1]
    }

    if (token) {
      const payload = verifyToken(token)
      if (payload) {
        c.set("user", { id: payload.sub, username: payload.username, role: payload.role })
        c.set("token", token)
      }
    }
    await next()
  }
}

function requireAuth(c: any) {
  const user = c.get("user")
  if (!user) return c.json({ error: "Unauthorized" }, 401)
  return null
}

function requireAdmin(c: any) {
  const user = c.get("user")
  if (!user || user.role !== "admin") return c.json({ error: "Forbidden" }, 403)
  return null
}

export function AuthRoutes(): Hono {
  const app = new Hono()

  app.post("/login", async (c) => {
    const { username, password } = await c.req.json<{ username: string; password: string }>()
    if (!username || !password) return c.json({ error: "Username and password required" }, 400)

    const user = getUserByUsername(username)
    if (!user) return c.json({ error: "Invalid credentials" }, 401)

    if (!verifyPassword(password, user.password_hash)) return c.json({ error: "Invalid credentials" }, 401)

    const token = createToken({ id: user.id, username: user.username, role: user.role })
    const maxAge = 7 * 24 * 60 * 60

    c.header("Set-Cookie", `opencode_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`)

    return c.json({
      user: { id: user.id, username: user.username, role: user.role },
      token,
    })
  })

  app.get("/me", jwtAuth(), async (c) => {
    const err = requireAuth(c)
    if (err) return err
    const user = c.get("user")
    return c.json({ user })
  })

  app.all("/logout", async (c) => {
    c.header("Set-Cookie", "opencode_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
    if (c.req.method === "GET") return c.redirect("/auth/login")
    return c.json({ ok: true })
  })

  app.get("/session", async (c) => {
    const authHeader = c.req.header("authorization") || ""
    const cookie = c.req.header("cookie") || ""

    let token: string | undefined
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7)
    } else {
      const match = cookie.match(/opencode_session=([^;]+)/)
      token = match?.[1]
    }

    if (!token) return c.json({ user: null })

    const payload = verifyToken(token)
    if (!payload) {
      c.header("Set-Cookie", "opencode_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
      return c.json({ user: null })
    }

    return c.json({ user: { id: payload.sub, username: payload.username, role: payload.role } })
  })

  app.post("/register", async (c) => {
    const existingCount = countUsers()
    if (existingCount > 0) return c.json({ error: "Registration closed. Contact an admin." }, 403)

    const { username, password } = await c.req.json<{ username: string; password: string }>()
    if (!username || !password) return c.json({ error: "Username and password required" }, 400)
    if (username.length < 3) return c.json({ error: "Username must be at least 3 characters" }, 400)
    if (password.length < 6) return c.json({ error: "Password must be at least 6 characters" }, 400)

    const existing = getUserByUsername(username)
    if (existing) return c.json({ error: "Username already taken" }, 409)

    const id = randomBytes(16).toString("hex")
    const passwordHash = hashPassword(password)
    const role = existingCount === 0 ? "admin" : "member"

    Database.transaction((tx) => {
      tx.insert(UserTable).values({ id, username, password_hash: passwordHash, role }).run()
    })

    const token = createToken({ id, username, role })
    const maxAge = 7 * 24 * 60 * 60
    c.header("Set-Cookie", `opencode_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`)

    return c.json({ user: { id, username, role }, token }, 201)
  })

  return app
}

export function UserManagementRoutes(): Hono {
  const app = new Hono()

  // Apply JWT middleware to all user routes
  app.use("*", jwtAuth())

  app.put("/password", async (c) => {
    const err = requireAuth(c)
    if (err) return err
    const user = c.get("user") as { id: string }
    const { currentPassword, newPassword } = await c.req.json<{ currentPassword: string; newPassword: string }>()
    if (!currentPassword || !newPassword) return c.json({ error: "Current and new password required" }, 400)
    if (newPassword.length < 6) return c.json({ error: "Password must be at least 6 characters" }, 400)
    const record = getUserById(user.id)
    if (!record) return c.json({ error: "User not found" }, 404)
    if (!verifyPassword(currentPassword, record.password_hash)) return c.json({ error: "Current password is incorrect" }, 403)
    updatePassword(user.id, hashPassword(newPassword))
    return c.json({ ok: true })
  })

  app.put("/:id/password", async (c) => {
    const err = requireAdmin(c)
    if (err) return err
    const id = c.req.param("id")
    const { newPassword } = await c.req.json<{ newPassword: string }>()
    if (!newPassword || newPassword.length < 6) return c.json({ error: "Password must be at least 6 characters" }, 400)
    const target = getUserById(id)
    if (!target) return c.json({ error: "User not found" }, 404)
    updatePassword(id, hashPassword(newPassword))
    return c.json({ ok: true })
  })

  app.get("/", async (c) => {
    const err = requireAdmin(c)
    if (err) return err
    const users = getAllUsers()
    return c.json({ users })
  })

  app.post("/", async (c) => {
    const err = requireAdmin(c)
    if (err) return err
    const { username, password, role } = await c.req.json<{ username: string; password: string; role?: string }>()
    if (!username || !password) return c.json({ error: "Username and password required" }, 400)
    if (username.length < 3) return c.json({ error: "Username must be at least 3 characters" }, 400)
    if (password.length < 6) return c.json({ error: "Password must be at least 6 characters" }, 400)
    const existing = getUserByUsername(username)
    if (existing) return c.json({ error: "Username already taken" }, 409)
    const id = randomBytes(16).toString("hex")
    const passwordHash = hashPassword(password)
    const userRole = role === "admin" ? "admin" : "member"
    Database.transaction((tx) => {
      tx.insert(UserTable).values({ id, username, password_hash: passwordHash, role: userRole }).run()
    })
    return c.json({ id, username, role: userRole }, 201)
  })

  app.put("/:id", async (c) => {
    const err = requireAdmin(c)
    if (err) return err
    const id = c.req.param("id")
    const { role } = await c.req.json<{ role: string }>()
    if (role !== "admin" && role !== "member") return c.json({ error: "Role must be 'admin' or 'member'" }, 400)
    const target = getUserById(id)
    if (!target) return c.json({ error: "User not found" }, 404)
    updateUserRole(id, role)
    return c.json({ ok: true })
  })

  app.delete("/:id", async (c) => {
    const err = requireAdmin(c)
    if (err) return err
    const id = c.req.param("id")
    const user = c.get("user") as { id: string }
    if (id === user.id) return c.json({ error: "Cannot delete yourself" }, 400)
    const target = getUserById(id)
    if (!target) return c.json({ error: "User not found" }, 404)
    deleteUser(id)
    return c.json({ ok: true })
  })

  return app
}
