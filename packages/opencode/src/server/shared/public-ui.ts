// Static UI assets and SPA bootstrap files the browser fetches without
// app-managed credentials. The SPA handles its own auth via localStorage JWT.
// API calls (POST/PUT/DELETE + /session, /provider, etc.) still require auth.
const PUBLIC_PATH_PREFIXES = [
  "/site.webmanifest",
  "/web-app-manifest-",
  "/favicon",
  "/apple-touch-icon",
  "/social-share",
  "/assets/",
  "/@",
  "/src/",
  "/node_modules/",
]

const API_PATH_PREFIXES = [
  "/session",
  "/provider",
  "/config",
  "/project",
  "/path",
  "/command",
  "/global",
  "/file",
  "/account",
  "/auth/",
  "/api/users",
]

export function isPublicUIPath(method: string, pathname: string) {
  if (method !== "GET") return false
  // Root page and static assets bypass auth
  if (pathname === "/") return true
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return true
  return false
}

export function isApiPath(pathname: string) {
  // Also exclude favicon/manifest etc from API check
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return false
  if (pathname === "/" || pathname === "/doc") return false
  return true
}
