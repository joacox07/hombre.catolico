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

Para el buscador y generador de arte, cargar también en Vercel (Production) y nunca en el
cliente: `OPENAI_API_KEY`, `OPENAI_VISION_MODEL` (opcional) e `IMAGEN_MODEL=gpt-image-2`.
La key sigue sin exponerse al navegador. El token GitHub necesita **Contents: Read and write**
para guardar el asset y la ficha de procedencia; Actions: Read and write para disparar el render.

Las referencias subidas al panel se envían sólo durante la generación, no se guardan en Vercel
ni GitHub. El panel guarda únicamente la imagen final y su procedencia.

Si una key se pegó en un chat, log o captura, revocarla en OpenAI y reemplazarla en Vercel antes
de usar el generador otra vez. No enviar secretos por el panel ni agregarlos al repositorio.

## Instalar en iPhone

Abrir `https://hombre-catolico.vercel.app` en **Safari**, iniciar sesión y tocar **Compartir →
Agregar a pantalla de inicio**. La app instalada conserva la interfaz y el último lote abierto
para consulta sin conexión. Buscar arte, generar, guardar, renderizar y descargar ZIP requieren
internet; al salir del panel se limpia ese lote de la caché local.

## Descargas

Cada corrida publica una release `lote-<id>` con un ZIP por pieza. Cada ZIP contiene los PNG
finales y `caption.txt`. Para el lote ya existente, ejecutar una vez el workflow
**Reempaquetar descargas** en GitHub Actions.
