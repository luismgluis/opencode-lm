import { Provider } from "@/provider/provider"
import { NamedError } from "@opencode-ai/core/util/error"
import { NotFoundError } from "@/storage/storage"
import { Session } from "@/session/session"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { ErrorHandler, MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import * as Log from "@opencode-ai/core/util/log"
import { Flag } from "@opencode-ai/core/flag/flag"
import { cors } from "hono/cors"
import { compress } from "hono/compress"
import * as ServerBackend from "./backend"

const log = Log.create({ service: "server" })

export const ErrorMiddleware: ErrorHandler = (err, c) => {
  log.error("failed", {
    error: err,
  })
  if (err instanceof NamedError) {
    let status: ContentfulStatusCode
    if (err instanceof NotFoundError) status = 404
    else if (err instanceof Provider.ModelNotFoundError) status = 400
    else if (err.name === "ProviderAuthValidationFailed") status = 400
    else if (err.name.startsWith("Worktree")) status = 400
    else status = 500
    return c.json(err.toObject(), { status })
  }
  if (err instanceof Session.BusyError) {
    return c.json(new NamedError.Unknown({ message: err.message }).toObject(), { status: 400 })
  }
  if (err instanceof HTTPException) return err.getResponse()
  const message = err instanceof Error && err.stack ? err.stack : err.toString()
  return c.json(new NamedError.Unknown({ message }).toObject(), {
    status: 500,
  })
}

function getSessionToken(c: { req: { header: (name: string) => string | undefined; query: (name: string) => string | undefined; raw: { headers: Headers } } }): string | null {
  const cookie = c.req.header("cookie")
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)opencode_session=([^;]*)/)
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

  const path = c.req.path
  const publicPaths = ["/auth/login", "/auth/register", "/auth/session", "/auth/check-register", "/auth/logout", "/auth/bar.js", "/favicon.ico", "/favicon-v3.ico", "/favicon-96x96-v3.png", "/apple-touch-icon-v3.png", "/social-share.png", "/site.webmanifest"]
  const isPublicPath = publicPaths.includes(path) || (c.req.method === "POST" && ["/auth/login", "/auth/register", "/auth/logout"].includes(path))

  // Try session-based auth
  const token = getSessionToken(c)
  if (token) {
    const { getSessionByToken } = await import("./auth/session")
    const session = getSessionByToken(token)
    if (session) {
      c.set("user", session.user)
      return next()
    }
  }

  // Public paths pass through
  if (isPublicPath) return next()

  const isStaticAsset = path.startsWith("/assets/") || path.startsWith("/favicon") || path === "/site.webmanifest" || path === "/social-share.png" || path === "/apple-touch-icon-v3.png"
  if (isStaticAsset) return next()

  const password = Flag.OPENCODE_SERVER_PASSWORD
  const isApiPath = path.startsWith("/api/") || path.startsWith("/global/") || path.startsWith("/session/") || path.startsWith("/provider/") || path.startsWith("/event") || path.startsWith("/experimental/")

  if (password) {
    const username = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"
    const authHeader = c.req.header("authorization") ?? ""
    const tokenFromQuery = c.req.query("auth_token")
    const basicToken = tokenFromQuery || authHeader.startsWith("Basic ") ? (tokenFromQuery || authHeader.slice(6)) : null
    let validBasic = false
    if (basicToken) {
      const decoded = Buffer.from(basicToken, "base64").toString()
      const [user, pass] = decoded.split(":")
      validBasic = user === username && pass === password
    }

    if (c.req.method === "GET" && !isApiPath) return c.redirect("/auth/login")

    if (validBasic) return next()
    return c.json({ error: "Unauthorized" }, 401)
  }

  return next()
}

export function LoggerMiddleware(backendAttributes: ServerBackend.Attributes): MiddlewareHandler {
  return async (c, next) => {
    const skip = c.req.path === "/log"
    if (skip) return next()
    const attributes = {
      method: c.req.method,
      path: c.req.path,
      ...backendAttributes,
    }
    log.info("request", attributes)
    const timer = log.time("request", attributes)
    await next()
    timer.stop()
  }
}

export function CorsMiddleware(opts?: { cors?: string[] }): MiddlewareHandler {
  return cors({
    maxAge: 86_400,
    origin(input) {
      if (!input) return

      if (input.startsWith("http://localhost:")) return input
      if (input.startsWith("http://127.0.0.1:")) return input
      if (input === "tauri://localhost" || input === "http://tauri.localhost" || input === "https://tauri.localhost")
        return input

      if (/^https:\/\/([a-z0-9-]+\.)*opencode\.ai$/.test(input)) return input
      if (opts?.cors?.includes(input)) return input
    },
  })
}

const zipped = compress()
export const CompressionMiddleware: MiddlewareHandler = (c, next) => {
  const path = c.req.path
  const method = c.req.method
  if (path === "/event" || path === "/global/event") return next()
  if (method === "POST" && /\/session\/[^/]+\/(message|prompt_async)$/.test(path)) return next()
  return zipped(c, next)
}
