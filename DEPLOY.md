# Despliegue en el servidor (baseserver)

Guía para compilar el binario de `opencode-lm` y reemplazarlo en el sistema para que el servicio `opencode-web.service` tome la nueva versión.

---

## Requisitos previos

- [Bun](https://bun.sh/) instalado (`bun --version`)
- Acceso root al servidor
- Repositorio clonado en `/opt/dev/opencode-lm`

---

## 1. Compilar el binario

```bash
cd /opt/dev/opencode-lm/packages/opencode
bun run build
```

El build genera los binarios en:

```
packages/opencode/dist/
├── opencode-linux-x64/bin/opencode      ← el que usamos
├── opencode-linux-x64-baseline/bin/opencode
├── opencode-linux-arm64/bin/opencode
└── ...
```

Al terminar muestra la versión compilada, por ejemplo:
```
Smoke test passed: 0.0.0-dev-202604292055
```

---

## 2. Reemplazar el binario del sistema

El binario del sistema es un symlink en `/usr/local/bin/opencode`. Se actualiza así:

```bash
ln -sfn /opt/dev/opencode-lm/packages/opencode/dist/opencode-linux-x64/bin/opencode /usr/local/bin/opencode
```

Verificar que el symlink apunta al build correcto:

```bash
opencode --version
# Debe mostrar: 0.0.0-dev-YYYYMMDDHHMMSS
```

---

## 3. Reiniciar el servicio web

El servicio `opencode-web.service` sirve la interfaz web en el puerto `4096`:

```bash
systemctl restart opencode-web.service
```

Verificar que quedó activo:

```bash
systemctl is-active opencode-web.service
# Debe mostrar: active

systemctl status opencode-web.service --no-pager -n 20
```

---

## Flujo completo (comandos de una sola vez)

```bash
cd /opt/dev/opencode-lm/packages/opencode && \
  bun run build && \
  ln -sfn /opt/dev/opencode-lm/packages/opencode/dist/opencode-linux-x64/bin/opencode /usr/local/bin/opencode && \
  opencode --version && \
  systemctl restart opencode-web.service && \
  systemctl is-active opencode-web.service
```

---

## Servicio systemd

Archivo: `/etc/systemd/system/opencode-web.service`

```ini
[Unit]
Description=OpenCode Web Interface
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dev
Environment=PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.nvm/versions/node/v24.13.1/bin
Environment=BROWSER=/usr/bin/true
ExecStart=/usr/local/bin/opencode web --hostname 0.0.0.0 --port 4096 --cors https://privateagent.auby.io --print-logs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Si se modifica el archivo `.service`, recargar el daemon antes de reiniciar:

```bash
systemctl daemon-reload
systemctl restart opencode-web.service
```

---

## Ver logs del servicio

```bash
# Logs en tiempo real
journalctl -u opencode-web.service -f

# Últimas 50 líneas
journalctl -u opencode-web.service -n 50 --no-pager
```

---

## Notas

- El binario del sistema siempre apunta al build de `linux-x64`. Para ARM usar `opencode-linux-arm64` en su lugar.
- La versión del binario activo se determina en tiempo de compilación con la fecha/hora (`YYYYMMDDHHMMSS`).
- El servicio web requiere credenciales configuradas como variables de entorno en el archivo `.service` (ver `/etc/systemd/system/opencode-web.service`).
- La base de datos activa se encuentra en `~/.local/share/opencode/opencode-dev.db`.
