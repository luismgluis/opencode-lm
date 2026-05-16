// @refresh reload
import { createSignal, Show } from "solid-js"

const STORAGE_KEY = "opencode_token"

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null
  return localStorage.getItem(STORAGE_KEY)
}

export function setToken(token: string) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearToken() {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

export function LoginForm(props: { onLogin: () => void }) {
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [error, setError] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [registerOpen, setRegisterOpen] = createSignal(false)

  const baseUrl = typeof location !== "undefined" ? location.origin : ""

  async function handleSubmit(e: Event) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username(), password: password() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Login failed")
        return
      }
      setToken(data.token)
      props.onLogin()
    } catch {
      setError("Connection error")
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: Event) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username(), password: password() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Registration failed")
        return
      }
      setToken(data.token)
      props.onLogin()
    } catch {
      setError("Connection error")
    } finally {
      setLoading(false)
    }
  }

  async function checkRegisterAvailable() {
    try {
      const res = await fetch(`${baseUrl}/auth/check-register`)
      if (res.status === 200) setRegisterOpen(true)
    } catch {}
  }

  // Check if registration is available on mount
  if (typeof window !== "undefined") checkRegisterAvailable()

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        "min-height": "100vh",
        background: "var(--background-base, #0d1117)",
        "font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          background: "var(--bg-card, #161b22)",
          border: "1px solid var(--border-default, #30363d)",
          "border-radius": "8px",
          padding: "32px",
          width: "100%",
          "max-width": "420px",
        }}
      >
        <h1
          style={{
            "font-size": "24px",
            "margin-bottom": "24px",
            color: "var(--text-heading, #f0f6fc)",
            "text-align": "center",
          }}
        >
          OpenCode
        </h1>
        <form onSubmit={handleSubmit}>
          <div style={{ "margin-bottom": "16px" }}>
            <label
              style={{
                display: "block",
                "font-size": "14px",
                "margin-bottom": "6px",
                color: "var(--text-muted, #8b949e)",
              }}
            >
              Username
            </label>
            <input
              type="text"
              required
              autocomplete="username"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-input, #0d1117)",
                border: "1px solid var(--border-default, #30363d)",
                "border-radius": "6px",
                color: "var(--text-primary, #c9d1d9)",
                "font-size": "14px",
                outline: "none",
                "box-sizing": "border-box",
              }}
            />
          </div>
          <div style={{ "margin-bottom": "16px" }}>
            <label
              style={{
                display: "block",
                "font-size": "14px",
                "margin-bottom": "6px",
                color: "var(--text-muted, #8b949e)",
              }}
            >
              Password
            </label>
            <input
              type="password"
              required
              autocomplete="current-password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-input, #0d1117)",
                border: "1px solid var(--border-default, #30363d)",
                "border-radius": "6px",
                color: "var(--text-primary, #c9d1d9)",
                "font-size": "14px",
                outline: "none",
                "box-sizing": "border-box",
              }}
            />
          </div>
          <Show when={error()}>
            <div
              style={{
                color: "var(--text-error, #f85149)",
                "font-size": "14px",
                "margin-bottom": "12px",
              }}
            >
              {error()}
            </div>
          </Show>
          <button
            type="submit"
            disabled={loading()}
            style={{
              width: "100%",
              padding: "10px",
              border: "none",
              "border-radius": "6px",
              "font-size": "14px",
              "font-weight": "600",
              cursor: loading() ? "not-allowed" : "pointer",
              background: "var(--bg-btn-primary, #238636)",
              color: "#fff",
              opacity: loading() ? 0.7 : 1,
            }}
          >
            {loading() ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <Show when={registerOpen()}>
          <div
            style={{
              "text-align": "center",
              "margin-top": "16px",
              "font-size": "14px",
              color: "var(--text-muted, #8b949e)",
            }}
          >
            No account?{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                handleRegister(e as any)
              }}
              style={{ color: "var(--accent-blue, #58a6ff)", "text-decoration": "none" }}
            >
              Create one
            </a>
          </div>
        </Show>
      </div>
    </div>
  )
}

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        clearToken()
        if (typeof location !== "undefined") location.reload()
      }}
      style={{
        padding: "6px 12px",
        "font-size": "13px",
        background: "transparent",
        border: "1px solid var(--border-default, #30363d)",
        "border-radius": "6px",
        color: "var(--text-muted, #8b949e)",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  )
}
