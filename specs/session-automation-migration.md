# Session Automation DB Migration

## Contexto del problema

Al ejecutar `opencode web` con la build dev (`0.0.0-dev-202604291958`) se observaba error al crear sesiones:

- `table session has no column named automation`

Esto ocurre cuando una base existente no tiene la columna `automation` en la tabla `session`, pero el código de `SessionTable` ya la exige.

## Archivos modificados

- `packages/opencode/migration/20260429202000_add_session_automation/migration.sql`
- `packages/opencode/test/storage/schema-upgrade.test.ts`

## Logica aplicada

### 1) Migracion de esquema

Se agrega una migracion SQL explicita para la tabla `session`:

```sql
ALTER TABLE `session` ADD `automation` text;
```

Objetivo: al arrancar, el migrador de Drizzle aplique el cambio pendiente en bases previas.

### 2) Prueba de regresion (upgrade real)

La prueba `schema-upgrade.test.ts` valida el flujo completo:

1. Carga todas las migraciones y ubica la migracion nueva.
2. Aplica migraciones hasta justo antes de `add_session_automation`.
3. Verifica que `session` aun no tiene columna `automation`.
4. Aplica todas las migraciones (upgrade).
5. Verifica que la columna `automation` existe.
6. Inserta un `project` y una `session` usando `automation` para comprobar que el esquema final soporta creacion de sesiones.

## Validacion recomendada

Desde `packages/opencode`:

```bash
bun test test/storage/schema-upgrade.test.ts
```

Luego en entorno real:

```bash
opencode --version
opencode session list -n 5
```

Y en modo web/API:

```bash
curl -u "<user>:<pass>" -H "content-type: application/json" -d '{}' http://127.0.0.1:4096/session
```

## Notas operativas

- Si una instancia ya fallo previamente por este motivo, conviene reiniciar el servicio despues del deploy de la migracion.
- En caso de rollback, conservar backup del `.db` antes de cambiar binario o ejecutar migraciones.
