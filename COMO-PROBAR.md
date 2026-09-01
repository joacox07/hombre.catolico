# Cómo probar la primera generación

Todo corre en **GitHub** (gratis). No hay que instalar ni alojar nada. La rama principal del
repo ya es la de trabajo, así que el workflow está listo para dispararse.

## Paso 1 — Elegir el cerebro de texto

### Modo actual — OpenAI para texto e imágenes

En el repo de GitHub:

1. **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `OPENAI_API_KEY` · Secret: *tu key de OpenAI* (`sk-...`). Guardar.

La key queda **encriptada** y solo se usa dentro del runner privado. **Nunca** aparece en el
código ni en la web.

> Opcional (pestaña *Variables*, no *Secrets*): `IMAGEN_QUALITY` (`high` por defecto),
> `OPENAI_TEXT_MODEL` (`gpt-4o`), `IMAGEN_MODEL` (`gpt-image-1`), `IMAGEN_SIZE` (`1024x1536`).

### Modo Codex — texto incluido en tu suscripción de ChatGPT

Cuando el servicio propio de `cerebro/` esté encendido y publicado por HTTPS, crear en GitHub Actions:

- Variable `TEXT_PROVIDER=codex_gateway`.
- Variable `CODEX_GATEWAY_URL=https://<tu-host>/v1`.
- Secret `CODEX_GATEWAY_TOKEN`: secreto aleatorio del gateway, distinto de toda contraseña o key.

En este modo, `OPENAI_API_KEY` se conserva exclusivamente para generar imágenes IA. El texto,
los captions, el plan de arte y el revisor editorial viajan al runtime Codex autenticado con tu
cuenta. Para volver al modo actual, quitar `TEXT_PROVIDER` o configurarlo como `openai`.

## Paso 2 — Disparar la generación

**Actions → "Lote semanal" → Run workflow** (podés poner cuántas piezas; por defecto 3).

El runner: elige 3 temas sin repetir → redacta con OpenAI → pasa el concilio + el candado de
citas → baja/genera el arte → renderiza → arma el lote → lo **commitea** al repo. Tarda unos
minutos. **Nada se publica en Instagram.**

## Paso 3 — Ver el resultado

- Los PNG y el lote quedan commiteados en `data/lotes/`, `data/piezas/` y `assets/arte/`.
- Para verlos en el **panel** (el "clon de Instagram"), falta publicar la web en GitHub Pages
  — es el próximo paso. Mientras tanto, los archivos generados ya están en el repo.

## Notas honestas

- **Imágenes IA**: OpenAI puede pedir **verificar la organización** para habilitar
  `gpt-image-1`. Si no está habilitada, el paso de imagen falla **sin romper la corrida**: la
  pieza sale con **fondo procedural** (chiaroscuro + grano) y el texto igual. Verificás la org
  en OpenAI cuando quieras y la próxima corrida ya trae imágenes.
- **Citas**: como las fichas de la biblioteca todavía están sin verificar, el candado marcará
  "citas por verificar". Es lo correcto: nada sale con una cita sin confirmar.
- **Costo**: ~US$3-6/mes (texto + imágenes en alta). Una corrida de prueba son centavos.
