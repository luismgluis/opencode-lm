# UPGRADE — opencode-lm (Custom Fork)

> **NUNCA USES `opencode --upgrade`** — ese comando descarga el binario oficial
> de opencode desde npm/GitHub, sobreescribiendo este fork con todos sus cambios
> custom.

## Estructura de remotos

```
origin     → git@github.com:luismgluis/opencode-lm.git   (tu fork)
anomalyco  → https://github.com/anomalyco/opencode.git    (upstream original)
```

El upstream original es `anomalyco/opencode`. El fork anterior
(`GriffinBoris/opencode`) ya no está disponible.

## Proceso de upgrade

### 1. Asegúrate de estar en `dev` y limpio

```bash
git checkout dev
git status
```

### 2. Trae los cambios del upstream original

```bash
git fetch anomalyco
```

### 3. Mergea upstream en tu `dev`

```bash
git merge anomalyco/dev
```

### 4. Resuelve conflictos

Los conflictos más comunes y cómo resolverlos:

| Tipo | Acción |
|------|--------|
| **`.github/workflows/*`** | Manténlos **eliminados** (el fork no usa CI de upstream) |
| **`package.json`** | Combina ambos: mantén scripts `build`/`build:lowprio`, agrega `upgrade-opentui` |
| **`packages/opencode/package.json`** | Agrega el import map `#hono` si se perdió |
| **`src/id/id.ts`** | Conserva `entry`, `automation`, `automation_run` + función `schema()` |
| **`src/session/session.sql.ts`** | Combina columnas `automation` + `agent`/`model` |
| **`src/session/session.ts`** | Combina schema `AutomationInfo` + `Model` |
| **`src/storage/db.ts`** | Usa singleton de upstream + patching de migración automation |
| **`src/server/server.ts`** | **Archivo crítico**: conserva versión Hono-based del fork (tiene auth/automation/middleware custom) |
| **Archivos eliminados por upstream** | Restáuralos con `git restore --source=HEAD~1 -- <files>` si nuestras rutas dependen de ellos (server routes, adaptors, util, etc.) |
| **SDK generados** | Acepta upstream (`git checkout --theirs -- ...`) y regenera |

Resuelve y luego:

```bash
git add <archivos-resueltos>
git commit
```

### 5. Reconstruye el binario

```bash
bun install
bun run --cwd packages/opencode build
```

Si el smoke test falla por error de zod v4 + bun bundler, usa:

```bash
bun run --cwd packages/opencode build -- --skip-smoke-test
```

El binario compilado queda en:

```
packages/opencode/dist/opencode-<platform>/bin/opencode
```

### 6. Verifica

```bash
bun dev --version
```

### 7. Push a tu fork

```bash
git push origin dev
```

## Si solo quieres compilar el binario (sin mergear upstream)

```bash
bun install
bun run --cwd packages/opencode build
```

## Rollback

Si el merge trae problemas, aborta con:

```bash
git merge --abort
```
