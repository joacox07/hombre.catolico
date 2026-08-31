# Notas de análisis de las referencias

El usuario subió ~85 referencias. En `curadas/` quedó una selección representativa de los
tres arquetipos que se repiten. De acá salió la **Dirección de arte v2** (`manual/05-estetica.md`).

## Factor común (lo que se repite en casi todas)

- **Imagen real y evocadora**: pintura clásica (entera o en crop editorial), foto sepia/vintage,
  o ilustración. Nunca gradiente plano.
- **Tratamiento cálido, oscuro y fílmico**: grano, viñeta, imagen oscurecida para que el texto
  respire.
- **Texto crema/dorado**; el **dorado** marca la frase o palabra clave.
- **Encabezado sobrio** en varios (monograma + @handle) tipo @adaeternum.

## Arquetipos observados

- **A · Impacto** (`A-impacto-*`, `A-cita-impacto-*`): pintura a sangre completa o crop editorial
  + sans negra condensada en mayúsculas, crema, tercio inferior. Para portadas y frases fuertes.
  Variante cita: «frase» + autor.
- **B · Texto largo** (`B-texto-largo-*`): pintura muy oscurecida + serif fina crema, interlineado
  amplio, **frase clave en dorado**, con cabecera de marca. Estilo @adaeternum.media. Para
  contenido formativo. Hay variantes con texto justificado y con encabezado en script (extractos
  de libro).
- **C · Cita devocional** (`C-cita-devocional-*`): foto sepia + serif/script cálido dorado, con
  palabras en versalitas para el énfasis. Para citas suaves de santos.

## Cómo se tradujo al sistema

- Tipografías: Anton (impacto), Cormorant/EB Garamond (serif), DM Sans (UI), Pinyon Script (acento).
- Capa de tratamiento única (grano + gradación cálida + viñeta) en `templates/pieza.css` que
  iguala arte descargado y generado.
- Tres plantillas = tres arquetipos, en `templates/render.js`.

> Las imágenes de `curadas/` son de otras cuentas (referencia de estilo, no para publicar). No
> se copian textos ni se reutilizan como fondos: sirven solo para calibrar el gusto visual.
