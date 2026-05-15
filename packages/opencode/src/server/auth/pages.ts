import { Hono } from "hono"
import { getSessionByToken } from "./session"

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - opencode</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg-page, #0d1117); color: var(--text-primary, #c9d1d9); display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .AuthPage__card { background: var(--bg-card, #161b22); border: 1px solid var(--border-default, #30363d); border-radius: 8px; padding: 32px; width: 100%; max-width: 480px; }
  .AuthPage__card--wide { max-width: 720px; }
  .AuthPage__title { font-size: 24px; margin-bottom: 24px; color: var(--text-heading, #f0f6fc); }
  .AuthPage__title--sm { font-size: 18px; margin-bottom: 16px; }
  .AuthPage__desc { font-size: 13px; color: var(--text-muted, #8b949e); margin-bottom: 8px; }
  .AuthPage__field { margin-bottom: 16px; }
  .AuthPage__label { display: block; font-size: 14px; margin-bottom: 6px; color: var(--text-muted, #8b949e); }
  .AuthPage__input { width: 100%; padding: 10px 12px; background: var(--bg-input, #0d1117); border: 1px solid var(--border-default, #30363d); border-radius: 6px; color: var(--text-primary, #c9d1d9); font-size: 14px; outline: none; }
  .AuthPage__input:focus { border-color: var(--accent-blue, #58a6ff); }
  .AuthPage__input--disabled { opacity: 0.6; }
  .AuthPage__select { width: 100%; padding: 10px 12px; background: var(--bg-input, #0d1117); border: 1px solid var(--border-default, #30363d); border-radius: 6px; color: var(--text-primary, #c9d1d9); font-size: 14px; outline: none; }
  .AuthPage__select:focus { border-color: var(--accent-blue, #58a6ff); }
  .AuthPage__btn { width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; }
  .AuthPage__btn--primary { background: var(--bg-btn-primary, #238636); color: #fff; }
  .AuthPage__btn--primary:hover { background: var(--bg-btn-primary-hover, #2ea043); }
  .AuthPage__btn--danger { background: var(--bg-btn-danger, #da3633); color: #fff; }
  .AuthPage__btn--danger:hover { background: var(--bg-btn-danger-hover, #f85149); }
  .AuthPage__btn--secondary { background: var(--bg-btn-secondary, #21262d); border: 1px solid var(--border-default, #30363d); color: var(--text-primary, #c9d1d9); }
  .AuthPage__btn--secondary:hover { background: var(--bg-btn-secondary-hover, #30363d); }
  .AuthPage__btn--sm { width: auto; padding: 4px 12px; font-size: 12px; margin: 0; }
  .AuthPage__error { color: var(--text-error, #f85149); font-size: 14px; margin-top: 8px; }
  .AuthPage__success { color: var(--text-success, #3fb950); font-size: 14px; margin-top: 8px; }
  .AuthPage__footer { text-align: center; margin-top: 16px; font-size: 14px; color: var(--text-muted, #8b949e); }
  .AuthPage__footer a { color: var(--accent-blue, #58a6ff); text-decoration: none; }
  .AuthPage__footer a:hover { text-decoration: underline; }
  .AuthPage__link { color: var(--accent-blue, #58a6ff); text-decoration: none; font-size: 14px; }
  .AuthPage__link:hover { text-decoration: underline; }
  .AuthPage__divider { border: none; border-top: 1px solid var(--border-default, #30363d); margin: 24px 0; }
  .NavBar { display: flex; gap: 4px; align-items: center; background: var(--bg-card, #161b22); border: 1px solid var(--border-default, #30363d); border-radius: 8px; padding: 12px 20px; margin-bottom: 24px; font-size: 14px; }
  .NavBar__link { color: var(--text-primary, #c9d1d9); text-decoration: none; padding: 6px 12px; border-radius: 6px; }
  .NavBar__link:hover { background: var(--bg-hover, #21262d); color: var(--text-heading, #f0f6fc); }
  .NavBar__link--active { background: var(--bg-active, #1f6feb33); color: var(--accent-blue, #58a6ff); }
  .NavBar__spacer { flex: 1; }
  .NavBar__userInfo { color: var(--text-muted, #8b949e); font-size: 13px; }
  .NavBar__logout { color: var(--text-error, #f85149); padding: 6px 12px; text-decoration: none; font-size: 13px; }
  .NavBar__logout:hover { text-decoration: underline; }
  .PortalPage__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
  .PortalPage__card { display: block; padding: 20px; background: var(--bg-input, #0d1117); border: 1px solid var(--border-default, #30363d); border-radius: 8px; text-decoration: none; color: var(--text-primary, #c9d1d9); }
  .PortalPage__card:hover { border-color: var(--accent-blue, #58a6ff); }
  .PortalPage__cardIcon { font-size: 24px; margin-bottom: 8px; }
  .PortalPage__cardTitle { font-weight: 600; }
  .PortalPage__cardDesc { font-size: 13px; color: var(--text-muted, #8b949e); }
  .AdminPage__header { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
  .AdminPage__addBtn { width: auto; margin: 0; margin-left: auto; }
  .AdminPage__createForm { display: none; padding: 16px; background: var(--bg-input, #0d1117); border: 1px solid var(--border-default, #30363d); border-radius: 8px; margin-bottom: 16px; }
  .AdminPage__table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  .AdminPage__table th, .AdminPage__table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border-default, #30363d); font-size: 14px; }
  .AdminPage__table th { color: var(--text-muted, #8b949e); font-weight: 600; }
  .AdminPage__badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .AdminPage__badge--admin { background: var(--bg-badge-admin, #1f6feb33); color: var(--accent-blue, #58a6ff); }
  .AdminPage__badge--member { background: var(--bg-badge-member, #23863633); color: var(--text-success, #3fb950); }
  .AdminPage__actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
</head>
<body>
${body}
</body>
</html>`
}

function navBar(username: string, role: string, current: string): string {
  const link = (href: string, label: string, icon: string) =>
    `<a href="${href}" class="NavBar__link${current === href ? " NavBar__link--active" : ""}">${icon} ${label}</a>`
  return `<nav class="NavBar">
    ${link("/auth/portal", "Home", "\u2302")}
    ${role === "admin" ? link("/auth/admin", "Users", "\u2630") : ""}
    ${link("/auth/settings", "Settings", "\u2699")}
    <span class="NavBar__spacer"></span>
    <span class="NavBar__userInfo">${username} (${role})</span>
    <a href="/auth/logout" class="NavBar__logout">Sign out</a>
  </nav>`
}

function loginPage(): string {
  return layout("Sign in", `
<div class="AuthPage__card LoginPage">
  <h1 class="AuthPage__title">Sign in</h1>
  <form id="loginForm" class="LoginPage__form">
    <div class="AuthPage__field">
      <label for="username" class="AuthPage__label">Username</label>
      <input type="text" id="username" name="username" class="AuthPage__input" required autocomplete="username">
    </div>
    <div class="AuthPage__field">
      <label for="password" class="AuthPage__label">Password</label>
      <input type="password" id="password" name="password" class="AuthPage__input" required autocomplete="current-password">
    </div>
    <button type="submit" class="AuthPage__btn AuthPage__btn--primary">Sign in</button>
    <div id="error" class="AuthPage__error" style="display:none"></div>
  </form>
  <div id="registerLink" class="AuthPage__footer" style="display:none">
    No account? <a href="/auth/register" class="AuthPage__link">Create one</a>
  </div>
</div>
<script>
  const err = document.getElementById(\'error\');
  document.getElementById(\'loginForm\').addEventListener(\'submit\', async (e) => {
    e.preventDefault(); err.style.display = \'none\';
    const r = await fetch(\'/auth/login\', { method:\'POST\', headers:{\'Content-Type\':\'application/json\'}, body:JSON.stringify({username:document.getElementById(\'username\').value, password:document.getElementById(\'password\').value}) });
    if (!r.ok) { const d = await r.json(); err.textContent = d.error || \'Login failed\'; err.style.display = \'block\'; return; }
    window.location.href = \'/auth/portal\';
  });
  fetch(\'/auth/session\').then(r => r.json()).then(d => { if (!d.user) fetch(\'/auth/check-register\').then(r => { if (r.status === 200) document.getElementById(\'registerLink\').style.display = \'block\'; }); });
</script>`)
}

function registerPage(): string {
  return layout("Create account", `
<div class="AuthPage__card RegisterPage">
  <h1 class="AuthPage__title">Create account</h1>
  <p class="AuthPage__desc">First user gets admin role</p>
  <form id="registerForm" class="RegisterPage__form">
    <div class="AuthPage__field">
      <label for="username" class="AuthPage__label">Username</label>
      <input type="text" id="username" name="username" class="AuthPage__input" required minlength="3" autocomplete="username">
    </div>
    <div class="AuthPage__field">
      <label for="password" class="AuthPage__label">Password</label>
      <input type="password" id="password" name="password" class="AuthPage__input" required minlength="6" autocomplete="new-password">
    </div>
    <button type="submit" class="AuthPage__btn AuthPage__btn--primary">Create account</button>
    <div id="error" class="AuthPage__error" style="display:none"></div>
  </form>
  <div class="AuthPage__footer">Already have an account? <a href="/auth/login" class="AuthPage__link">Sign in</a></div>
</div>
<script>
  document.getElementById(\'registerForm\').addEventListener(\'submit\', async (e) => {
    e.preventDefault(); const err = document.getElementById(\'error\'); err.style.display = \'none\';
    const r = await fetch(\'/auth/register\', { method:\'POST\', headers:{\'Content-Type\':\'application/json\'}, body:JSON.stringify({username:document.getElementById(\'username\').value, password:document.getElementById(\'password\').value}) });
    if (!r.ok) { const d = await r.json(); err.textContent = d.error || \'Registration failed\'; err.style.display = \'block\'; return; }
    window.location.href = \'/auth/portal\';
  });
</script>`)
}

function portalPage(username: string, role: string): string {
  return layout("Home", `
<div class="AuthPage__card AuthPage__card--wide PortalPage">
  ${navBar(username, role, "/auth/portal")}
  <h1 class="AuthPage__title">Welcome, ${username}</h1>
  <p class="AuthPage__desc">You are signed in as <strong>${role}</strong>.</p>
  <div class="PortalPage__grid">
    <a href="/auth/settings" class="PortalPage__card">
      <div class="PortalPage__cardIcon">\u2699</div>
      <div class="PortalPage__cardTitle">Settings</div>
      <div class="PortalPage__cardDesc">Change password and profile</div>
    </a>
    <a href="/" class="PortalPage__card">
      <div class="PortalPage__cardIcon">\u2693</div>
      <div class="PortalPage__cardTitle">OpenCode App</div>
      <div class="PortalPage__cardDesc">Launch the full web interface</div>
    </a>
    ${role === "admin" ? `
    <a href="/auth/admin" class="PortalPage__card">
      <div class="PortalPage__cardIcon">\u2630</div>
      <div class="PortalPage__cardTitle">User Management</div>
      <div class="PortalPage__cardDesc">Add, remove, and manage users</div>
    </a>` : ""}
  </div>
</div>`)
}

function settingsPage(username: string, role: string): string {
  return layout("Settings", `
<div class="AuthPage__card AuthPage__card--wide">
  ${navBar(username, role, "/auth/settings")}
  <h1 class="AuthPage__title AuthPage__title--sm">Change Password</h1>
  <form id="passwordForm">
    <div class="AuthPage__field">
      <label for="currentPassword" class="AuthPage__label">Current Password</label>
      <input type="password" id="currentPassword" class="AuthPage__input" required>
    </div>
    <div class="AuthPage__field">
      <label for="newPassword" class="AuthPage__label">New Password</label>
      <input type="password" id="newPassword" class="AuthPage__input" required minlength="6">
    </div>
    <button type="submit" class="AuthPage__btn AuthPage__btn--primary">Update Password</button>
    <div id="error" class="AuthPage__error" style="display:none"></div>
    <div id="success" class="AuthPage__success" style="display:none"></div>
  </form>
</div>
<script>
  document.getElementById(\'passwordForm\').addEventListener(\'submit\', async (e) => {
    e.preventDefault();
    const err = document.getElementById(\'error\'); err.style.display = \'none\';
    const suc = document.getElementById(\'success\'); suc.style.display = \'none\';
    const r = await fetch(\'/api/users/password\', { method:\'PUT\', headers:{\'Content-Type\':\'application/json\'}, body:JSON.stringify({currentPassword:document.getElementById(\'currentPassword\').value, newPassword:document.getElementById(\'newPassword\').value}) });
    if (!r.ok) { const d = await r.json(); err.textContent = d.error || \'Failed\'; err.style.display = \'block\'; return; }
    suc.textContent = \'Password updated successfully\'; suc.style.display = \'block\'; document.getElementById(\'currentPassword\').value = \'\'; document.getElementById(\'newPassword\').value = \'\';
  });
</script>`)
}

function adminPageHtml(username: string, role: string): string {
  return layout("User Management", `
<div class="AuthPage__card AuthPage__card--wide">
  ${navBar(username, role, "/auth/admin")}
  <div class="AdminPage__header">
    <h1 class="AuthPage__title AuthPage__title--sm" style="margin:0">Users</h1>
    <button id="showCreateBtn" class="AuthPage__btn AuthPage__btn--secondary AuthPage__btn--sm AdminPage__addBtn">+ Add User</button>
  </div>
  <div id="createForm" class="AdminPage__createForm">
    <div class="AuthPage__field">
      <label for="newUsername" class="AuthPage__label">Username</label>
      <input type="text" id="newUsername" class="AuthPage__input" required minlength="3">
    </div>
    <div class="AuthPage__field">
      <label for="newPassword" class="AuthPage__label">Password</label>
      <input type="password" id="newPassword" class="AuthPage__input" required minlength="6">
    </div>
    <div class="AuthPage__field">
      <label for="newRole" class="AuthPage__label">Role</label>
      <select id="newRole" class="AuthPage__select"><option value="member">Member</option><option value="admin">Admin</option></select>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="createUser()" class="AuthPage__btn AuthPage__btn--primary AuthPage__btn--sm">Create</button>
      <button onclick="hideCreate()" class="AuthPage__btn AuthPage__btn--secondary AuthPage__btn--sm">Cancel</button>
    </div>
    <div id="createError" class="AuthPage__error" style="display:none"></div>
  </div>
  <table class="AdminPage__table"><thead><tr><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody id="usersBody"></tbody></table>
</div>
<script>
  const formatDate = (ts) => new Date(ts).toLocaleDateString();
  async function loadUsers() {
    const r = await fetch(\'/api/users\'); if (!r.ok) return;
    const { users } = await r.json();
    document.getElementById(\'usersBody\').innerHTML = users.sort((a,b) => a.username.localeCompare(b.username)).map(u => \'<tr>\' +
      \'<td>\' + u.username + \'</td>\' +
      \'<td><select class="AdminPage__select" style="width:auto" onchange="changeRole(\\\'' + u.id + \'\\\', this.value)"><option value="member"\' + (u.role===\'member\'?\' selected\':\'\') + \'>Member</option><option value="admin"\' + (u.role===\'admin\'?\' selected\':\'\') + \'>Admin</option></select></td>\' +
      \'<td>\' + formatDate(u.time_created) + \'</td>\' +
      \'<td class="AdminPage__actions"><button onclick="deleteUser(\\\'' + u.id + \'\\\')" class="AuthPage__btn AuthPage__btn--danger AuthPage__btn--sm">Delete</button></td>\' +
      \'</tr>\').join(\'\');
  }
  async function createUser() {
    const err = document.getElementById(\'createError\'); err.style.display = \'none\';
    const r = await fetch(\'/api/users\', { method:\'POST\', headers:{\'Content-Type\':\'application/json\'}, body:JSON.stringify({username:document.getElementById(\'newUsername\').value, password:document.getElementById(\'newPassword\').value, role:document.getElementById(\'newRole\').value}) });
    if (!r.ok) { const d = await r.json(); err.textContent = d.error || \'Failed\'; err.style.display = \'block\'; return; }
    hideCreate(); document.getElementById(\'newUsername\').value = \'\'; document.getElementById(\'newPassword\').value = \'\'; loadUsers();
  }
  loadUsers();
</script>`)
}

function getSessionUser(c: any): { id: string; username: string; role: string } | null {
  try {
    const cookie = c.req.header("cookie")
    const match = cookie?.match(/opencode_session=([^;]+)/)
    const token = match?.[1]
    
    const sessionToken = token ? decodeURIComponent(token) : (() => {
      const auth = c.req.header("authorization")
      return auth?.startsWith("Bearer ") ? auth.slice(7) : null
    })()
    
    if (!sessionToken) return null
    const session = getSessionByToken(sessionToken)
    return session ? session.user : null
  } catch {
    return null
  }
}

export function AuthPagesRoutes(): Hono {
  const app = new Hono()

  app.get("/login", (c) => c.html(loginPage()))
  app.get("/register", (c) => c.html(registerPage()))

  app.get("/check-register", async (c) => {
    const { countUsers } = await import("./session")
    return countUsers() === 0 ? c.body(null, 200) : c.body(null, 403)
  })

  app.get("/portal", (c) => {
    const user = getSessionUser(c)
    if (!user) return c.redirect("/auth/login")
    return c.html(portalPage(user.username, user.role))
  })

  app.get("/settings", (c) => {
    const user = getSessionUser(c)
    if (!user) return c.redirect("/auth/login")
    return c.html(settingsPage(user.username, user.role))
  })

  app.get("/admin", (c) => {
    const user = getSessionUser(c)
    if (!user) return c.redirect("/auth/login")
    if (user.role !== "admin") return c.html("<h1>Forbidden: Admin only</h1>", 403)
    return c.html(adminPageHtml(user.username, user.role))
  })

  return app
}
