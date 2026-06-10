# opencode-lm Fork — Customizations & Merge Guide

Este documento detalla todas las modificaciones y features implementadas en **opencode-lm** (fork de `anomalyco/opencode`) que **no existen en el upstream estándar**. Sirve como checklist para no perder funcionalidad al mergear desde `anomalyco/dev`.

---

## 1. Sistema de Autenticación Nativo (JWT + SQLite)

**Feature:** Login/registro con JWT, sesiones persistentes via cookie, panel admin, roles (admin/member).

| Archivo | Propósito |
|---------|-----------|
| `packages/opencode/src/server/auth/hash.ts` | Hashing de passwords (scrypt) |
| `packages/opencode/src/server/auth/session.ts` | CRUD usuarios, JWT create/verify, user_data key-value |
| `packages/opencode/src/server/auth/routes.ts` | Endpoints Hono: `/auth/login`, `/auth/register`, `/auth/me`, `/auth/logout`, `/api/users/*` |
| `packages/opencode/src/server/auth/pages.ts` | HTML server-rendered: login, register, admin, portal, settings |
| `packages/opencode/src/server/auth/user.sql.ts` | Drizzle schema para tabla `user` |
| `packages/opencode/src/server/auth/hono.d.ts` | Type augmentation para `c.get("user")` en Hono |
| `packages/app/src/components/login-form.tsx` | Login form SPA (incrustado en home) |
| `packages/app/src/components/settings-users.tsx` | Tab "User Management" en settings |

### Dependencias de auth con upstream:
- **Tablas `user`, `auth_session`, `user_data`** — Creadas con `CREATE TABLE IF NOT EXISTS`, NO existen en upstream
- **Archivo `public-ui.ts`** — Expandido con ~15 bypass paths para assets estáticos
- **`authorization.ts`** — Middleware Effect que verifica JWT. Upstream usa Basic Auth puro. Nuestro fork mantiene AMBOS
- **`server.ts` (uiRoute handler)** — Monta Hono auth app via bridge
- **`entry.tsx`** — Auth redirect check (aunque fue eliminado en production build, reemplazado por server-side redirect)

### Al mergear:
1. `authorization.ts` es **HIGH RISK** — mantener inline JWT verification con `node:crypto`
2. Las rutas `/auth/*` y `/api/users/*` NO deben pasar por el middleware de auth de upstream
3. Verificar que los imports de `storage/db` → `@opencode-ai/core/database/database` sigan funcionando
4. Las tablas fork-specific (`user`, `auth_session`, `user_data`) deben crearse con `CREATE TABLE IF NOT EXISTS` en `session.ts`
5. La DB path resolution (`resolveDbPath()`) debe mantener el canal `dev` → `opencode-dev.db`

---

## 2. Login Redirect Server-Side (302)

**Feature:** `GET /` sin autenticación redirige a `/auth/login` (HTTP 302).

### Implementación:
- `packages/opencode/src/server/routes/instance/httpapi/server.ts` (línea ~225):
  - Handler de `/*` catch-all checkea JWT via cookie o Bearer header
  - Sin JWT válido → `302 Found → /auth/login`

### Al mergear:
- Verificar que el handler catch-all mantenga el check de JWT
- Las rutas públicas (`/assets/*`, `/favicon*`, etc.) deben seguir bypassando auth
- La cookie `opencode_session` se setea en `/auth/login` (routes.ts línea 98)

---

## 3. Settings Persistence Key (v5)

**Feature:** Cada cambio de defaults requiere bump de `settings.vX` para forzar reseteo.

| Archivo | Detalle |
|---------|---------|
| `packages/app/src/context/settings.tsx:155` | `persisted("settings.v5", ...)` |

**Historial de versiones:**
| Clave | Cambio |
|-------|--------|
| `settings.v4` | Sistema upstream (no tenemos control) |
| `settings.v5` | Fork: `showCustomAgents: true` por defecto |

### Al mergear:
- Si upstream cambia a `settings.v5`, subir a `settings.v6`
- La función `withFallback()` usa `??` (nullish coalescing) — `false` guardado prevalece sobre default `true`

---

## 4. Slack Notifications on Failed Login

**Feature:** Alerta via webhook cuando un login falla.

| Archivo | Detalle |
|---------|---------|
| `packages/opencode/src/server/auth/routes.ts:22-37` | Función `sendSlackAlert()` |
| `/etc/systemd/system/opencode-web.service` | `Environment=SLACK_NOTIFICATIONS_WEBHOOK=...` |

### Al mergear:
- Verificar que `sendSlackAlert()` sea llamado en todos los branches de fallo del login handler
- La variable de entorno debe preservarse

---

## 5. Quick Reply Dock

**Feature:** Badges de respuestas rápidas arriba del input de chat, persistidas en localStorage.

| Archivo | Detalle |
|---------|---------|
| `packages/app/src/components/session-quick-reply-dock.tsx` | Componente standalone |
| `packages/app/src/pages/session/composer/session-composer-region.tsx` | Integración arriba de `<PromptInput>` |

### Al mergear:
- Este archivo fue creado fork-specific — verificar que exista post-merge
- El `Persist.global("quick-replies")` es frontend-only, sin backend

---

## 6. Server-Side User Data Persistence

**Feature:** Datos de usuario (projects list, settings) persisten en servidor, no solo localStorage.

| Archivo | Detalle |
|---------|---------|
| `packages/opencode/src/server/auth/session.ts` | Tabla `user_data`, funciones `getUserData()`/`setUserData()`/`deleteUserData()` |
| `packages/opencode/src/server/auth/routes.ts` | Endpoints `GET/PUT/DELETE /api/users/data/:key` |
| `packages/app/src/pages/home.tsx` | Sync de project list al servidor |

### Al mergear:
- La tabla `user_data` debe crearse con `CREATE TABLE IF NOT EXISTS`
- Los endpoints REST deben preservarse
- El frontend `home.tsx` tiene lógica de sync que puede romperse si upstream refactoriza

---

## 7. Plan Agent Orange Styling (Dropdown)

**Feature:** El agente "plan" en el dropdown se muestra con color naranja para distinción visual.

| Archivo | Detalle |
|---------|---------|
| `packages/ui/src/styles/theme.css` | Variables `--icon-agent-plan-base` |
| `packages/app/src/components/prompt-input.tsx` | `ComposerAgentControl` con toggle CSS |

### Al mergear:
- Verificar que `ComposerAgentControl` tenga `classList` toggle con `isPlan()`
- `showCustomAgents` debe default `true` (settings persistence key)

---

## 8. Sign Out Button en Home

**Feature:** Botón "Sign out" en sidebar del home, debajo de Help.

| Archivo | Detalle |
|---------|---------|
| `packages/app/src/pages/home.tsx` | Botón con localStorage cleanup + redirect a `/auth/logout` |

### Al mergear:
- Verificar que el botón sobreviva refactors del layout/home

---

## 9. Infraestructura y Deploy

| Item | Detalle | Archivo |
|------|---------|---------|
| Systemd service | `opencode-web.service` con `MemoryMax=800M` | `/etc/systemd/system/opencode-web.service` |
| Seed script | `seed-user.ts` para bootstrapping | `scripts/seed-user.ts` (necesita fix de DB path) |
| DB path | Usa `opencode-dev.db` (canal `dev`) | `packages/opencode/src/server/auth/session.ts` |
| Reverse proxy | Docker nginx-proxy-manager → `localhost:4096` | N/A |
| Build | `bun run packages/opencode/script/build.ts` | Build output → `/usr/local/bin/opencode-lm` |
| Pre-build | `.github/TEAM_MEMBERS` placeholder | `touch .github/TEAM_MEMBERS` |

---

## 10. Variables de Entorno Requeridas

| Variable | Propósito | Seteada en |
|----------|-----------|------------|
| `OPENCODE_SERVER_PASSWORD` | JWT signing secret + Basic Auth | systemd service (vacía = JWT-only) |
| `SLACK_NOTIFICATIONS_WEBHOOK` | Alertas de login fallido | systemd service |
| `BROWSER=/usr/bin/true` | Evita `xdg-open` warnings | systemd service |

---

## 11. Archivos Eliminados del Upstream

| Archivo | Razón |
|---------|-------|
| `.github/*` (CI, templates) | Fork cleanup — no necesitamos CI de anomalyco |
| `packages/opencode/src/sync/index.ts` | Eliminado por upstream en merge — EventV2 bridge obsoleto |

---

## Merge Conflict Risk Assessment

### HIGH RISK (esperar conflictos):
- `packages/opencode/src/server/routes/instance/httpapi/middleware/authorization.ts` — JWT vs Basic Auth
- `packages/opencode/src/server/routes/instance/httpapi/server.ts` — uiRoute handler con auth redirect
- `packages/opencode/src/server/shared/public-ui.ts` — bypass paths expandidos
- `packages/app/src/context/settings.tsx` — persistence key v5
- `packages/app/src/components/prompt-input.tsx` — agent dropdown + quick replies

### MEDIUM RISK:
- `packages/opencode/src/server/auth/` (todo el directorio) — nuevo para fork
- `packages/app/src/components/login-form.tsx` — nuevo para fork
- `packages/app/src/components/settings-users.tsx` — nuevo para fork
- `packages/app/src/entry.tsx` — auth helpers + logout handler

### LOW RISK:
- `packages/app/src/pages/home.tsx` — sign out button
- `packages/app/src/components/session-quick-reply-dock.tsx` — nuevo para fork
- Archivos de UI/theme (cambios menores de color)

---

## Post-Merge Verification Checklist

```bash
# 1. Auth básico
curl -s -D - http://localhost:4096/ | head -1          # → 302
curl -s -D - http://localhost:4096/auth/login | head -1 # → 200

# 2. Login + sesión
curl -s -X POST http://localhost:4096/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}'            # → 200 + token + cookie

# 3. API sin auth
curl -s -o /dev/null -w '%{http_code}' http://localhost:4096/global/health  # → 401

# 4. SPA con auth
curl -s -H "Authorization: Bearer <TOKEN>" http://localhost:4096/ | head -5 # → 200 HTML

# 5. Reconstruir + deploy
systemctl stop opencode-web.service
bun run packages/opencode/script/build.ts
cp dist/opencode-linux-x64/bin/opencode /usr/local/bin/opencode-lm
OPENCODE_CHANNEL=dev bun run scripts/seed-user.ts <user> <pass> admin
systemctl start opencode-web.service

# 6. Verificar settings key
grep -c 'settings.v5' packages/app/dist/assets/index-*.js  # debe ser > 0
```
