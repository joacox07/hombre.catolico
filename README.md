# @hombre.catolico — sistema de contenido

Sistema de producción de contenido para la cuenta de Instagram **@hombre.catolico**:
formación católica masculina con eje en San José y los pilares **Fe · Virtud · Deber · Familia**.

El sistema genera un **lote semanal** de piezas (carruseles y posts de cita), las revisa
contra una biblioteca de fuentes aprobadas, las renderiza con una estética tradicional
consistente y las muestra en un panel de previsualización para que una persona apruebe,
corrija o descarte antes de publicar.

> **No es una cuenta oficial de la Iglesia.** Es un proyecto laical de formación. No
> reemplaza el consejo de un sacerdote ni de un director espiritual.

## Principio rector

**Estética tradicional + contenido interesante + fuentes católicas serias + distinción
explícita entre doctrina y opinión.**

Ninguna afirmación fuerte se publica sin una fuente verificable de la biblioteca, y toda
pieza distingue con claridad entre Escritura, Magisterio, Padres y Doctores, autores
espirituales y opinión prudencial.

## Estructura del repo

```
manual/       Manual editorial: identidad, voz, taxonomía doctrina/opinión, temas sensibles
library/      Biblioteca de fuentes aprobadas (fichas). Corpus + verdad para verificar citas
data/         Estado editorial: backlog de temas, registro de lo publicado, balance de pilares
templates/    Plantillas HTML/CSS de las piezas (carrusel doctrinal, santo/cita)
assets/       Arte de dominio público con procedencia y licencia registradas
pipeline/     (Fase 1) Job semanal: selección → recuperación → generación → QA → render
panel/        (Fase 1-2) Panel web "clon de Instagram" para previsualizar y aprobar
scripts/      Utilitarios (render de plantillas a PNG, etc.)
.claude/skills/revisor-sacerdote/   Filtro doctrinal ("pensá como un sacerdote formado")
```

## Estado

- [x] **Fase 0 — Fundaciones:** estructura, manual, biblioteca (esquema + semilla),
      skill de revisión doctrinal, plantillas visuales, render de prueba.
- [x] **Fase 1 — Pipeline + visor:** generación con QA y verificación de citas, render y panel.
- [x] **Fase 2 — Mesa editorial:** aprobar / pedir cambios / descartar con persistencia versionada,
      descargas ZIP y dirección de arte con procedencia.
- [ ] **Fase 3 — Reels completos.** Hay portada 9:16, pero no edición ni publicación de video.
- [ ] **Fase 4 — Graph API auto-publish + métricas.**

El panel es una PWA privada para Vercel. Requiere `PANEL_PASSWORD`, `SESSION_SECRET` y una
conexión GitHub de alcance mínimo (`GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`,
`GITHUB_BRANCH`); ver [`.env.example`](.env.example). La aprobación humana y la publicación
final en Instagram siguen siendo deliberadamente manuales.

## Costo

Fijo ~$0 (corridas locales o GitHub Actions gratis). Variable: solo tokens de LLM, con
tope bajo. Sin servicios pagos en fase 1.

## Cómo se usa (Fase 0)

```bash
npm install
npm run render:sample   # renderiza una pieza de ejemplo a PNG en out/
```

Ver `manual/` antes de tocar el contenido y `library/README.md` para el formato de las fichas.
