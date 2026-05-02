import { Flag } from "@opencode-ai/core/flag/flag"
import { Hono } from "hono"
import { proxy } from "hono/proxy"
import { getMimeType } from "hono/utils/mime"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"

const embeddedUIPromise = Flag.OPENCODE_DISABLE_EMBEDDED_WEB_UI
  ? Promise.resolve(null)
  : // @ts-expect-error - generated file at build time
    import("opencode-web-ui.gen.ts").then((module) => module.default as Record<string, string>).catch(() => null)

const DEFAULT_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; media-src 'self' data:; connect-src 'self' data:"

const csp = (hash = "") =>
  `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'${hash ? ` 'sha256-${hash}'` : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; media-src 'self' data:; connect-src 'self' data:`

const LOGOUT_BAR_HTML = `<!-- oc-logout-bar -->
<div id="ocAuthBar" style="position:fixed;top:0;right:0;z-index:99999;display:none;align-items:center;gap:8px;padding:6px 14px;background:#161b22;border:1px solid #30363d;border-radius:0 0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#c9d1d9;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
  <span style="color:#8b949e" id="ocUserName"></span>
  <a href="/auth/portal" style="color:#58a6ff;text-decoration:none;font-size:13px">Settings</a>
  <span style="color:#30363d">|</span>
  <a href="/auth/logout" style="color:#f85149;text-decoration:none;font-weight:600;font-size:13px">Logout</a>
</div>
<script src="/auth/bar.js"></script>`

function injectLogoutBar(html: string): string {
  return html.replace("</body>", LOGOUT_BAR_HTML + "\n</body>")
}

export const UIRoutes = (): Hono =>
  new Hono().all("/*", async (c) => {
    const embeddedWebUI = await embeddedUIPromise
    const path = c.req.path

    if (embeddedWebUI) {
      const match = embeddedWebUI[path.replace(/^\//, "")] ?? embeddedWebUI["index.html"] ?? null
      if (!match) return c.json({ error: "Not Found" }, 404)

      if (await fs.exists(match)) {
        const mime = getMimeType(match) ?? "text/plain"
        c.header("Content-Type", mime)
        if (mime.startsWith("text/html")) {
          const content = await fs.readFile(match, "utf-8")
          c.header("Content-Security-Policy", DEFAULT_CSP)
          return c.body(injectLogoutBar(content))
        }
        return c.body(new Uint8Array(await fs.readFile(match)))
      } else {
        return c.json({ error: "Not Found" }, 404)
      }
    } else {
      const response = await proxy(`https://app.opencode.ai${path}`, {
        raw: c.req.raw,
        headers: {
          ...Object.fromEntries(c.req.raw.headers.entries()),
          host: "app.opencode.ai",
        },
      })
      const isHtml = response.headers.get("content-type")?.includes("text/html")
      if (isHtml) {
        const text = await response.clone().text()
        const match = text.match(
          /<script\b(?![^>]*\bsrc\s*=)[^>]*\bid=(['"])oc-theme-preload-script\1[^>]*>([\s\S]*?)<\/script>/i,
        )
        const hash = match ? createHash("sha256").update(match[2]).digest("base64") : ""
        response.headers.set("Content-Security-Policy", csp(hash))
        return c.body(injectLogoutBar(text))
      }
      return response
    }
  })
