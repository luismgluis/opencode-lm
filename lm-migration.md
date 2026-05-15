# LM Fork Migration Report

> Merge: `anomalyco/opencode` (dev) → `luismgluis/opencode-lm` (dev)
> Date: 2026-05-14
> Commits merged: 963

## Estructura de remotos

```
origin     → git@github.com:luismgluis/opencode-lm.git    (fork LM)
anomalyco  → https://github.com/anomalyco/opencode.git     (upstream original)
```

El anterior upstream `GriffinBoris/opencode` ya no existe (404). Se reemplazó por `anomalyco/opencode` directo.

## Features custom preservadas del fork

| Feature | Archivos clave |
|---------|---------------|
| **Automations** | `src/automation/index.ts`, `src/server/routes/automation.ts`, `src/cli/cmd/automation.ts`, `packages/app/src/pages/automations.tsx` |
| **Native auth** | `src/server/auth/*`, `src/server/middleware.ts`, `src/server/routes/ui.ts` |
| **Server Hono-based** | `src/server/server.ts` (con middleware custom: AuthMiddleware, AutomationRoutes, UIRoutes) |
| **Migration patching** | `src/storage/db.ts` (`patchAlreadyAppliedAutomationMigration`) |
| **Custom keybinds** | `src/config/keybinds.ts`, `src/cli/cmd/tui/context/keybind.tsx` |
| **CI eliminados** | `.github/workflows/*` |
| **ID schema** | `src/id/id.ts` (`automation`, `automation_run`, `entry` prefixes + `schema()` fn) |

## Problemas conocidos (post-merge)

### 1. Efecto colateral: Effect beta.57 → beta.65

El upstream actualizó Effect de `4.0.0-beta.57` a `4.0.0-beta.65`. Esto eliminó la propiedad `.zod` de los Effect Schema. Nuestras rutas Hono preservadas dependen de ella.

**Síntoma:** `opencode serve` / `opencode web` crashea con:

```
TypeError: ...["~standard"] is not a function
```

**Causa:** 27 archivos de rutas Hono usan `Schema.zod` (ej: `Config.Info.zod`, `Workspace.Info.zod`, `Auth.Info.zod`, `MCP.Status.zod`). En beta.65 estos schemas son Effect puros sin `.zod`.

**Fix:** Reemplazar cada `Schema.zod` por `zodObject(Schema)` (de `@/util/effect-zod`) o schema Zod inline.

**Archivos a modificar:**

```
src/server/routes/global.ts           — Config.Info.zod (×3)
src/server/routes/control/workspace.ts — Workspace.Info.zod, .zodObject (×6)
src/server/routes/control/index.ts    — ProviderID.zod, Auth.Info.zod (×3)
src/server/routes/instance/mcp.ts     — MCP.Status.zod, ConfigMCP.Info.zod (×6)
src/server/routes/instance/pty.ts     — Pty.Info.zod
src/server/routes/instance/permission.ts — PermissionID.zod, Permission.Reply.zod (×3)
src/server/routes/instance/question.ts — QuestionID.zod, Question.Answer.zod (×3)
src/server/routes/automation.ts       — Automation.Info, Automation.Preview
```

### 2. hono-openapi v1.1.2 → v1.3.0

Actualizado para compatibilidad con Effect v4 (v1.1.2 tenía peer dep `effect: ^3.x`). Ya resuelto.

### 3. Workspace deps faltantes

- `@opencode-ai/ui@workspace:*` — agregado como dependencia de `packages/opencode`
- `@opentui/keymap@0.2.10` — instalado manualmente

### 4. Bun lockfile

El `bun.lock` del merge commit incluye versiones beta.48 y beta.57 de Effect como dependencias transitivas. No causan problemas en tiempo de compilación pero pueden generar confusiones en el bundle.

## Qué funciona

- `opencode --version` ✅
- `opencode <directory>` (TUI) — probablemente ✅ (usa AppRuntime completo)
- `bun dev` (desarrollo) — desde source, el error es `BusEvent.payloads` que fue parcheado
- Build con `--skip-smoke-test` ✅

## Qué NO funciona

- `opencode serve` ❌ (crashea por `.zod` references)
- `opencode web` ❌ (ídem)
- `systemctl start opencode-web.service` ❌

## Próximos pasos

1. Reemplazar todos los `Schema.zod` en las rutas Hono por `zodObject(Schema)`
2. Rebuild y smoke test
3. Re-desplegar: `ln -sfn <binary> /usr/local/bin/opencode && systemctl restart opencode-web.service`

Tiempo estimado: ~30-60 min (trabajo mecánico sobre 27 archivos).
