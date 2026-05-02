import { Hono } from "hono"

function layout(title: string, body: string, extra?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - opencode</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0d1117; color: #c9d1d9; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 32px; width: 100%; max-width: 480px; }
  .card-wide { max-width: 720px; }
  h1 { font-size: 24px; margin-bottom: 24px; color: #f0f6fc; }
  .field { margin-bottom: 16px; }
  label { display: block; font-size: 14px; margin-bottom: 6px; color: #8b949e; }
  input, select { width: 100%; padding: 10px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font-size: 14px; outline: none; }
  input:focus, select:focus { border-color: #58a6ff; }
  button { width: 100%; padding: 10px; background: #238636; border: none; border-radius: 6px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; }
  button:hover { background: #2ea043; }
  button.danger { background: #da3633; }
  button.danger:hover { background: #f85149; }
  button.secondary { background: #21262d; border: 1px solid #30363d; }
  button.secondary:hover { background: #30363d; }
  .error { color: #f85149; font-size: 14px; margin-top: 8px; }
  .success { color: #3fb950; font-size: 14px; margin-top: 8px; }
  .link { color: #58a6ff; text-decoration: none; font-size: 14px; }
  .link:hover { text-decoration: underline; }
  .footer { text-align: center; margin-top: 16px; font-size: 14px; color: #8b949e; }
  .footer a { color: #58a6ff; text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
  .nav { display: flex; gap: 4px; align-items: center; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 12px 20px; margin-bottom: 24px; font-size: 14px; }
  .nav a { color: #c9d1d9; text-decoration: none; padding: 6px 12px; border-radius: 6px; }
  .nav a:hover { background: #21262d; color: #f0f6fc; }
  .nav a.active { background: #1f6feb33; color: #58a6ff; }
  .nav .spacer { flex: 1; }
  .nav .user-info { color: #8b949e; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #30363d; font-size: 14px; }
  th { color: #8b949e; font-weight: 600; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .badge.admin { background: #1f6feb33; color: #58a6ff; }
  .badge.member { background: #23863633; color: #3fb950; }
  .actions { display: flex; gap: 8px; }
  .actions button { width: auto; padding: 4px 12px; font-size: 12px; margin: 0; }
  .flex { display: flex; gap: 16px; align-items: center; }
  .flex-wrap { flex-wrap: wrap; }
  .ml-auto { margin-left: auto; }
  .mt-16 { margin-top: 16px; }
  .mb-8 { margin-bottom: 8px; }
  .text-sm { font-size: 13px; color: #8b949e; }
  ${extra ?? ""}
</style>
</head>
<body>
${body}
</body>
</html>`
}

function navBar(username: string, role: string, current: string): string {
  const link = (href: string, label: string, icon: string) =>
    `<a href="${href}" class="${current === href ? "active" : ""}">${icon} ${label}</a>`
  return `<div class="nav">
    ${link("/auth/portal", "Home", "\u2302")}
    ${role === "admin" ? link("/auth/admin", "Users", "\u2630") : ""}
    ${link("/auth/settings", "Settings", "\u2699")}
    <span class="spacer"></span>
    <span class="user-info">${username} (${role})</span>
    <a href="/auth/logout" style="color:#f85149;padding:6px 12px;text-decoration:none;font-size:13px">Sign out</a>
  </div>`
}

function loginPage(): string {
  return layout("Sign in", `
<div class="card">
  <h1>Sign in</h1>
  <form id="loginForm">
    <div class="field">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required autocomplete="username">
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password">
    </div>
    <button type="submit">Sign in</button>
    <div id="error" class="error" style="display:none"></div>
  </form>
  <div class="footer" id="registerLink" style="display:none">
    No account? <a href="/auth/register" class="link">Create one</a>
  </div>
</div>
<script>
  const err = document.getElementById('error');
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); err.style.display = 'none';
    const r = await fetch('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:document.getElementById('username').value, password:document.getElementById('password').value}) });
    if (!r.ok) { const d = await r.json(); err.textContent = d.error || 'Login failed'; err.style.display = 'block'; return; }
    window.location.href = '/auth/portal';
  });
  fetch('/auth/session').then(r => r.json()).then(d => { if (!d.user) fetch('/auth/check-register').then(r => { if (r.status === 200) document.getElementById('registerLink').style.display = 'block'; }); });
</script>`)
}

function registerPage(): string {
  return layout("Create account", `
<div class="card">
  <h1>Create account</h1>
  <p class="text-sm mb-8">First user gets admin role</p>
  <form id="registerForm">
    <div class="field">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required minlength="3" autocomplete="username">
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required minlength="6" autocomplete="new-password">
    </div>
    <button type="submit">Create account</button>
    <div id="error" class="error" style="display:none"></div>
  </form>
  <div class="footer">Already have an account? <a href="/auth/login" class="link">Sign in</a></div>
</div>
<script>
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const err = document.getElementById('error'); err.style.display = 'none';
    const r = await fetch('/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:document.getElementById('username').value, password:document.getElementById('password').value}) });
    if (!r.ok) { const d = await r.json(); err.textContent = d.error || 'Registration failed'; err.style.display = 'block'; return; }
    window.location.href = '/auth/portal';
  });
</script>`)
}

function portalPage(username: string, role: string): string {
  return layout("Home", `
<div class="card card-wide">
  ${navBar(username, role, "/auth/portal")}
  <h1>Welcome, ${username}</h1>
  <p class="text-sm">You are signed in as <strong>${role}</strong>.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px">
    <a href="/auth/settings" style="display:block;padding:20px;background:#0d1117;border:1px solid #30363d;border-radius:8px;text-decoration:none;color:#c9d1d9">
      <div style="font-size:24px;margin-bottom:8px">\u2699</div>
      <div style="font-weight:600">Settings</div>
      <div class="text-sm">Change password and profile</div>
    </a>
    <a href="/" style="display:block;padding:20px;background:#0d1117;border:1px solid #30363d;border-radius:8px;text-decoration:none;color:#c9d1d9">
      <div style="font-size:24px;margin-bottom:8px">\u2693</div>
      <div style="font-weight:600">OpenCode App</div>
      <div class="text-sm">Launch the full web interface</div>
    </a>
    ${role === "admin" ? `
    <a href="/auth/admin" style="display:block;padding:20px;background:#0d1117;border:1px solid #30363d;border-radius:8px;text-decoration:none;color:#c9d1d9">
      <div style="font-size:24px;margin-bottom:8px">\u2630</div>
      <div style="font-weight:600">User Management</div>
      <div class="text-sm">Add, remove, and manage users</div>
    </a>` : ""}
  </div>
</div>`)
}

function settingsPage(username: string, role: string, userId: string): string {
  return layout("Settings", `
<div class="card card-wide">
  ${navBar(username, role, "/auth/settings")}
  <h1>Settings</h1>
  <div class="field">
    <label>Username</label>
    <input type="text" value="${username}" disabled style="opacity:0.6">
  </div>
  <div class="field">
    <label>Role</label>
    <input type="text" value="${role}" disabled style="opacity:0.6">
  </div>
  <div style="border-top:1px solid #30363d;margin:24px 0"></div>
  <h2 style="font-size:18px;margin-bottom:16px">Change password</h2>
  <form id="passwordForm">
    <div class="field">
      <label for="currentPassword">Current password</label>
      <input type="password" id="currentPassword" required>
    </div>
    <div class="field">
      <label for="newPassword">New password</label>
      <input type="password" id="newPassword" required minlength="6">
    </div>
    <button type="submit">Update password</button>
    <div id="error" class="error" style="display:none"></div>
    <div id="success" class="success" style="display:none"></div>
  </form>
</div>
<script>
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('error'); const suc = document.getElementById('success');
    err.style.display = 'none'; suc.style.display = 'none';
    const r = await fetch('/api/users/password', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({currentPassword:document.getElementById('currentPassword').value, newPassword:document.getElementById('newPassword').value}) });
    if (!r.ok) { const d = await r.json(); err.textContent = d.error || 'Failed'; err.style.display = 'block'; return; }
    suc.textContent = 'Password updated successfully'; suc.style.display = 'block';
    document.getElementById('currentPassword').value = ''; document.getElementById('newPassword').value = '';
  });
</script>`)
}

function adminPageHtml(username: string, role: string): string {
  return layout("Users", `
<div class="card card-wide">
  ${navBar(username, role, "/auth/admin")}
  <div class="flex flex-wrap mb-8">
    <h1>User Management</h1>
    <button class="secondary" style="width:auto;margin:0;margin-left:auto" onclick="showCreate()">+ Add user</button>
  </div>
  <div id="createForm" style="display:none" class="mt-16" style="padding:16px;background:#0d1117;border:1px solid #30363d;border-radius:8px;margin-bottom:16px">
    <div class="field">
      <label for="newUsername">Username</label>
      <input type="text" id="newUsername" required minlength="3">
    </div>
    <div class="field">
      <label for="newPassword">Password</label>
      <input type="password" id="newPassword" required minlength="6">
    </div>
    <div class="field">
      <label for="newRole">Role</label>
      <select id="newRole"><option value="member">Member</option><option value="admin">Admin</option></select>
    </div>
    <div class="flex">
      <button onclick="createUser()">Create</button>
      <button class="secondary" onclick="hideCreate()">Cancel</button>
    </div>
    <div id="createError" class="error" style="display:none"></div>
  </div>
  <table>
    <thead><tr><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
    <tbody id="usersBody"></tbody>
  </table>
</div>
<script>
  document.getElementById('usersBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const name = btn.dataset.username;
    if (action === 'promote') { await fetch('/api/users/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({role:'admin'}) }); loadUsers(); }
    else if (action === 'demote') { await fetch('/api/users/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({role:'member'}) }); loadUsers(); }
    else if (action === 'resetpw') { const pw = prompt('New password for ' + name + ' (min 6 chars):'); if (!pw || pw.length < 6) { alert('Password must be at least 6 characters'); return; } await fetch('/api/users/'+id+'/password', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({newPassword:pw}) }); alert('Password reset for ' + name); }
    else if (action === 'remove') { if (!confirm('Delete this user?')) return; await fetch('/api/users/'+id, { method:'DELETE' }); loadUsers(); }
  });
  function showCreate() { document.getElementById('createForm').style.display = 'block'; }
  function hideCreate() { document.getElementById('createForm').style.display = 'none'; document.getElementById('createError').style.display = 'none'; }
  async function loadUsers() {
    const res = await fetch('/api/users');
    if (res.status === 401 || res.status === 403) { window.location.href = '/auth/login'; return; }
    const d = await res.json();
    document.getElementById('usersBody').innerHTML = d.users.map(u => \`<tr>
      <td>\${u.username}</td>
      <td><span class="badge \${u.role}">\${u.role}</span></td>
      <td>\${new Date(u.time_created).toLocaleDateString()}</td>
      <td class="actions" style="flex-wrap:wrap">
        \${u.role === 'admin'
          ? '<button class="secondary" data-action="demote" data-id="' + u.id + '">Demote</button>'
          : '<button class="secondary" data-action="promote" data-id="' + u.id + '">Promote</button>'}
        \${'<button class="secondary" data-action="resetpw" data-id="' + u.id + '" data-username="' + u.username + '">Reset PW</button>'}
        \${'<button class="danger" data-action="remove" data-id="' + u.id + '">Delete</button>'}
      </td>
    </tr>\`).join('');
  }
  async function createUser() {
    const err = document.getElementById('createError'); err.style.display = 'none';
    const r = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:document.getElementById('newUsername').value, password:document.getElementById('newPassword').value, role:document.getElementById('newRole').value}) });
    if (!r.ok) { const d = await r.json(); err.textContent = d.error || 'Failed'; err.style.display = 'block'; return; }
    hideCreate(); document.getElementById('newUsername').value = ''; document.getElementById('newPassword').value = ''; loadUsers();
  }
  loadUsers();
</script>`)
}

export const LOGOUT_BAR_SCRIPT = `(function(){try{var x=new XMLHttpRequest();x.open('GET','/auth/session',false);x.withCredentials=true;x.send();if(x.status===200){var d=JSON.parse(x.responseText);if(d&&d.user){document.getElementById('ocUserName').textContent=d.user.username;document.getElementById('ocAuthBar').style.display='flex'}}}catch(e){}})();`

export function AuthPagesRoutes(): Hono {
  const app = new Hono()

  app.get("/login", (c) => c.html(loginPage()))
  app.get("/register", (c) => c.html(registerPage()))

  app.get("/check-register", async (c) => {
    const { countUsers } = await import("./session")
    return countUsers() === 0 ? c.body(null, 200) : c.body(null, 403)
  })

  app.get("/portal", (c) => {
    const user: { username: string; role: string } | undefined = c.get("user")
    if (!user) return c.redirect("/auth/login")
    return c.html(portalPage(user.username, user.role))
  })

  app.get("/settings", (c) => {
    const user: { id: string; username: string; role: string } | undefined = c.get("user")
    if (!user) return c.redirect("/auth/login")
    return c.html(settingsPage(user.username, user.role, user.id))
  })

  app.get("/bar.js", (c) => {
    c.header("Content-Type", "application/javascript")
    c.header("Cache-Control", "no-cache, no-store, must-revalidate")
    return c.body(LOGOUT_BAR_SCRIPT)
  })

  app.get("/admin", (c) => {
    const user: { username: string; role: string } | undefined = c.get("user")
    if (!user) return c.redirect("/auth/login")
    if (user.role !== "admin") return c.html("<h1>Forbidden: Admin only</h1>", 403)
    return c.html(adminPageHtml(user.username, user.role))
  })

  return app
}
