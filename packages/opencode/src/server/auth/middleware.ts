import type { MiddlewareHandler } from "hono"
import { Flag } from "@opencode-ai/core/flag/flag"
import { basicAuth } from "hono/basic-auth"
import { getSessionByToken } from "./session"

export type AuthUser = {
  id: string
  username: string
  role: "admin" | "member"
}

const SESSION_COOKIE = "opencode_session"

function getSessionToken(c: { req: { header: (name: string) => string | undefined; query: (name: string) => string | undefined; raw: { headers: Headers } } }): string | null {
  const cookie = c.req.header("cookie")
  if (cookie) {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`))
    if (match) return decodeURIComponent(match[1])
  }
  const header = c.req.header("authorization")
  if (header?.startsWith("Bearer ")) return header.slice(7)
  const query = c.req.query("auth_token")
  if (query) return query
  return null
}

export const AuthMiddleware: MiddlewareHandler = async (c, next) => {
  if (c.req.method === "OPTIONS") return next()

  const legacyPassword = Flag.OPENCODE_SERVER_PASSWORD
  const legacyUsername = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"

  // Try session-based auth first
  const token = getSessionToken(c)
  if (token) {
    const session = getSessionByToken(token)
    if (session) {
      c.set("user", session.user)
      return next()
    }
  }

  // Fall back to Basic Auth (legacy) if configured
  if (legacyPassword) {
    if (c.req.query("auth_token") && !token) {
      c.req.raw.headers.set("authorization", `Basic ${c.req.query("auth_token")}`)
    }
    return basicAuth({ username: legacyUsername, password: legacyPassword })(c, next)
  }

  return next()
}

export function requireRole(...roles: string[]): MiddlewareHandler {
  return async (c, next) => {
    const user: AuthUser | undefined = c.get("user")
    if (!user) return c.json({ error: "Unauthorized" }, 401)
    if (roles.length > 0 && !roles.includes(user.role)) return c.json({ error: "Forbidden" }, 403)
    return next()
  }
}
