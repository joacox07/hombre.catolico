# Panel móvil en Vercel

El panel usa Vercel para la web y GitHub Actions para generar las piezas. No poner secretos
en `.env` ni en el código: se cargan en Vercel como variables de Production.

## Variables

- `PANEL_PASSWORD` — clave de acceso al panel.
- `SESSION_SECRET` — texto aleatorio largo, distinto de la contraseña.
- `GITHUB_TOKEN` — fine-grained token restringido a `joacox07/hombre.catolico`, con
  **Actions: Read and write** y **Contents: Read and write**. La Mesa editorial usa
  Contents para persistir aprobaciones, cambios y descartes.
- `GITHUB_OWNER=joacox07`, `GITHUB_REPO=hombre.catolico` y
  `GITHUB_BRANCH=claude/hombre-catolico-instagram-ogg8ao`.

`OPENAI_API_KEY` sigue sólo en GitHub Actions. El panel nunca la recibe.

## Descargas

Cada corrida publica una release `lote-<id>` con un ZIP por pieza. Cada ZIP contiene los PNG
finales y `caption.txt`. Para el lote ya existente, ejecutar una vez el workflow
**Reempaquetar descargas** en GitHub Actions.
