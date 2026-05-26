import { createResource, createSignal, For, Show, type Component } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Select } from "@opencode-ai/ui/select"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"

type User = {
  id: string
  username: string
  role: "admin" | "member"
  time_created?: number
}

const ROLE_OPTIONS = ["member", "admin"] as const

function authHeaders(): Record<string, string> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("opencode_token") : null
  if (!token) return {}
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...init?.headers } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? "Request failed")
  }
  return res.json()
}

const SettingsUsers: Component = () => {
  const language = useLanguage()
  const [showForm, setShowForm] = createSignal(false)

  const [users, { refetch }] = createResource<User[]>(async () => {
    const data = await api<{ users: User[] }>("/api/users")
    return data.users
  })

  const deleteUser = async (id: string) => {
    try {
      await api(`/api/users/${id}`, { method: "DELETE" })
      showToast({ title: language.t("toast.user.deleted"), variant: "success" })
      refetch()
    } catch (err) {
      showToast({ title: err instanceof Error ? err.message : "Delete failed", variant: "error" })
    }
  }

  const changeRole = async (id: string, role: string) => {
    try {
      await api(`/api/users/${id}`, { method: "PUT", body: JSON.stringify({ role }) })
      showToast({ title: language.t("toast.user.updated"), variant: "success" })
      refetch()
    } catch (err) {
      showToast({ title: err instanceof Error ? err.message : "Update failed", variant: "error" })
    }
  }

  const changePassword = async (id: string) => {
    const newPassword = prompt(language.t("settings.users.enterNewPassword"))
    if (!newPassword || newPassword.length < 6) {
      showToast({ title: language.t("settings.users.passwordTooShort"), variant: "error" })
      return
    }
    try {
      await api(`/api/users/${id}/password`, { method: "PUT", body: JSON.stringify({ newPassword }) })
      showToast({ title: language.t("toast.user.passwordUpdated"), variant: "success" })
    } catch (err) {
      showToast({ title: err instanceof Error ? err.message : "Password change failed", variant: "error" })
    }
  }

  const [newUsername, setNewUsername] = createSignal("")
  const [newPassword, setNewPassword] = createSignal("")
  const [newRole, setNewRole] = createSignal<"member" | "admin">("member")

  const createUser = async (e: Event) => {
    e.preventDefault()
    const username = newUsername()
    const password = newPassword()
    const role = newRole()
    if (!username || username.length < 3) {
      showToast({ title: language.t("settings.users.usernameTooShort"), variant: "error" })
      return
    }
    if (!password || password.length < 6) {
      showToast({ title: language.t("settings.users.passwordTooShort"), variant: "error" })
      return
    }
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify({ username, password, role }) })
      showToast({ title: language.t("toast.user.created"), variant: "success" })
      setShowForm(false)
      setNewUsername("")
      setNewPassword("")
      setNewRole("member")
      refetch()
    } catch (err) {
      showToast({ title: err instanceof Error ? err.message : "Creation failed", variant: "error" })
    }
  }

  return (
    <div class="flex flex-col gap-4 p-4 h-full">
      <div class="flex items-center justify-between">
        <h2 class="text-16-semibold text-text">{language.t("settings.users.title")}</h2>
        <Button variant="secondary" size="small" onClick={() => setShowForm(!showForm())}>
          <Icon name="plus" />
          {language.t("settings.users.addUser")}
        </Button>
      </div>

      <Show when={showForm()}>
        <form onSubmit={createUser} class="flex flex-col gap-3 p-3 bg-bg-card rounded-lg border border-border">
          <div class="flex gap-3 items-end">
            <TextField
              name="username"
              placeholder={language.t("settings.users.usernamePlaceholder")}
              required
              minLength={3}
              value={newUsername()}
              onChange={setNewUsername}
              class="flex-1"
            />
            <TextField
              name="password"
              type="password"
              placeholder={language.t("settings.users.passwordPlaceholder")}
              required
              minLength={6}
              value={newPassword()}
              onChange={setNewPassword}
              class="flex-1"
            />
            <Select
              options={[...ROLE_OPTIONS]}
              current={newRole()}
              value={(r) => r}
              label={(r) => r === "admin" ? language.t("settings.users.roleAdmin") : language.t("settings.users.roleMember")}
              onSelect={(r) => { if (r) setNewRole(r as "admin" | "member") }}
              triggerVariant="settings"
            />
            <Button type="submit" variant="primary" size="small">
              {language.t("settings.users.create")}
            </Button>
            <Button type="button" variant="ghost" size="small" onClick={() => setShowForm(false)}>
              {language.t("settings.users.cancel")}
            </Button>
          </div>
        </form>
      </Show>

      <div class="flex flex-col gap-1 overflow-y-auto">
        <For each={users()}>
          {(user) => (
            <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors">
              <div class="flex-1 min-w-0">
                <div class="text-14-medium text-text truncate">{user.username}</div>
                <div class="text-12-regular text-text-weak">
                  {user.time_created ? new Date(user.time_created).toLocaleDateString() : ""}
                </div>
              </div>
              <Select
                options={[...ROLE_OPTIONS]}
                current={user.role}
                value={(r) => r}
                label={(r) => r === "admin" ? language.t("settings.users.roleAdmin") : language.t("settings.users.roleMember")}
                onSelect={(r) => { if (r) changeRole(user.id, r as string) }}
                triggerVariant="settings"
              />
              <Button variant="secondary" size="small" onClick={() => changePassword(user.id)}>
                <Icon name="keyboard" />
              </Button>
              <Button variant="ghost" size="small" onClick={() => deleteUser(user.id)}>
                <Icon name="trash" />
              </Button>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}

export { SettingsUsers }
