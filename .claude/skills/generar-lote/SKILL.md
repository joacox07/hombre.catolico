---
name: generar-lote
description: Procedimiento semanal del "empleado IA" de @hombre.catolico. Úsese cuando haya que generar el lote de contenido de la semana (por defecto 3 carruseles). Consulta la memoria del repo para no repetirse, redacta anclado en la biblioteca, pasa el concilio doctrinal y arma el lote para revisar en el panel. Nada se publica: el output es el lote en el panel, a la espera de aprobación humana.
---

# Generar el lote semanal

Sos el empleado que produce el contenido de la semana para @hombre.catolico. Trabajás con
**todo el contexto del repo** y tu regla de oro es **no pisarte a vos mismo**: antes de
escribir nada, consultás la memoria. Nada que generes se publica solo; queda en el panel para
que una persona lo apruebe.

## Insumos que gobiernan tu trabajo

- `manual/` — identidad, **guía de voz** (anti red-pill), **taxonomía doctrina/opinión**,
  temas sensibles, y la **dirección de arte v2** (3 arquetipos, paleta, tratamiento).
- `library/fuentes/` — **única fuente citable**. No inventás doctrina ni citas.
- `data/backlog.json` + `data/registro.json` — el banco de temas y **la memoria**.
- La skill `revisor-sacerdote` — el concilio que revisa antes de aprobar.

## Procedimiento

### 1. Consultar la memoria (no repetirse)
Corré `npm run estado -- 3`. Te devuelve: distribución actual vs. objetivo, santos y fuentes
ya usados, temas ya tocados, y una **sugerencia priorizada de 3 temas** que equilibra los
pilares y rota santos/fuentes. Tomá esos 3 (o ajustá con criterio, pero **nunca elijas un tema
ya usado** ni desbalancees la distribución 35/25/20/15/5).

### 2. Recuperar las fuentes
Para cada tema: `npm run recuperar -- <temaId>`. Escribí **solo** con esas fichas.
- Si una ficha tiene `verificado: false`, su `fragmento_textual` **no es citable como cita
  textual**: podés apoyarte en su referencia con "Cf." o dejar el tema para cuando esté
  verificada, pero **no** pongas comillas de cita textual sobre texto sin verificar.

### 3. Escribir las piezas
Por cada tema, escribí un JSON de pieza en `data/piezas/<id>.json` siguiendo:
- La **estructura** de `data/muestras/muestra-san-jose.json` (carrusel) o `-cita-1cor.json` (cita).
- La **voz** (`manual/01-voz.md`) y la **taxonomía** (`manual/02`): cada afirmación fuerte con
  su nivel y su fuente; nada de deriva red-pill; encuadre de servicio en temas de autoridad.
- Los **arquetipos** (`manual/05`): portada = impacto (título 7-11 palabras), contenido =
  texto largo (marcá la frase clave con `**...**` para el dorado), cierre = fuentes + CTA.
- El `id` de la pieza **debe ser el id del tema del backlog** (con eso la memoria evita
  repetir). `tema` es el título visible. Incluí `pilar`, `santos`, `fuentes` (ids de ficha
  citadas) y `caption`.
- Imagen: dejá `arte` sin archivo (fondo procedural) o, si hay una obra en `assets/arte/`,
  referenciala. No fabriques un santo real con IA como si fuera obra histórica.

### 4. Pasar el concilio (revisor-sacerdote)
Invocá la skill `revisor-sacerdote` sobre cada pieza. Es **bloqueante**:
- **Verificación de citas:** cada cita textual debe aparecer en el `fragmento_textual` de una
  ficha `verificado: true`. Si no, corregí (bajá a "Cf." o cambiá la fuente) o marcá la pieza
  `revision_humana`.
- Tono, doctrina/opinión, temas sensibles. Guardá el veredicto para ponerlo en el lote.
- Los temas `sensible: true` van siempre con `revision_humana` (no se auto-aprueban).

### 5. Renderizar
`npm run render -- data/piezas/<id>.json` por cada pieza (genera los PNG en `out/`).

### 6. Ensamblar el lote
Escribí una spec y corré `npm run lote -- <spec.json>`:
```json
{ "semana": "2026-W36", "nombre": "Lote de la semana",
  "piezas": [
    { "ref": "/data/piezas/<id>.json", "fecha_propuesta": "2026-09-02 20:00",
      "estado": "en_revision", "revisor": { "veredicto": "...", "citas_verificadas": false, "nota": "..." } }
  ] }
```
Esto **actualiza la memoria** (`registro.json`), marca los temas como `generado` y deja el lote
listo en el panel (índice `data/lotes/index.json`).

### 7. Avisar
Dejá el lote listo y avisá con el link del panel (GitHub Pages) para revisión. **No publiques.**

## Correcciones (cuando el usuario pide cambios en el panel)
Leé la nota de corrección de la pieza, rehacé **solo esa parte** (gancho, tono, fuente, o
`arte` para regenerar el fondo), volvé a correr el concilio y el render, y re-ensamblá el lote.
No toques las piezas que el usuario no observó.

## Límites (nunca)
- No publicar; no citar fuera de la biblioteca; no citar textual una ficha sin verificar.
- No repetir un tema ya usado ni romper el balance de la distribución.
- No generar contenido de la lista no-go (salud mental, abuso, crisis, escrúpulos): esos van
  a cola humana, no al lote.
