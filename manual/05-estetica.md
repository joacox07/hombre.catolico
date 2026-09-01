# Dirección de arte (v2)

Sale del factor común de las referencias del usuario (ver `referencias/`). Reemplaza la v1
(gradiente plano) que "no transmitía nada".

## Principio

**Imagen real y evocadora + tratamiento editorial sobrio + texto crema y dorado.**
La imagen carga el peso emocional; el texto va encima, sobrio. El dorado marca la frase clave.

## Paleta

Definida en `templates/tokens.css`.

| Nombre | Hex | Uso |
|--------|-----|-----|
| Negro cálido | `#14110D` | fondo base |
| Carbón | `#1C1712` | fondos |
| Tabaco / Café | `#3A2F23` / `#4B4034` | capas |
| Crema | `#ECE3D2` | texto principal |
| **Dorado** | `#C9A24B` / claro `#D8B25A` | acento y **frase clave** |
| Vino / Oliva | `#6A4841` / `#555949` | apoyos puntuales |

## Tipografía (`assets/fonts/`, embebidas)

- **Anton** — impacto: titulares en mayúsculas (arquetipo A).
- **Cormorant Garamond** — serif display: títulos y citas.
- **EB Garamond** — serif de texto largo (arquetipo B), muy legible en párrafo.
- **DM Sans** — etiquetas, kickers, fuentes, UI.
- **Pinyon Script** — acento manuscrito, uso mínimo (arquetipo C).

## Capa de tratamiento (lo que unifica todo)

Toda imagen —descargada o generada por IA— pasa por la misma capa en `templates/pieza.css`:
**arte → paleta elegida → viñeta/oscurecido → grano fílmico**. La identidad se sostiene con
tipografía y tratamiento, sin teñir cada obra de dorado o ámbar.

## Tres arquetipos

- **A · Enunciado / cita de impacto** — imagen a sangre completa + Anton en mayúsculas (crema),
  tercio inferior, kicker dorado, subtítulo en cursiva. Para portadas de carrusel y frases fuertes.
- **B · Texto largo formativo** — imagen muy oscurecida + EB Garamond crema, interlineado amplio,
  **frase clave en dorado**, encabezado con monograma ✠ + "Hombre Católico" + @handle. Para
  contenido doctrinal y captions largos como imagen. (En el texto, marcá el destacado con `**...**`.)
- **C · Cita devocional cálida** — foto sepia/duotono o pintura + Cormorant en cursiva centrado,
  autor en script dorado, fuente en versalitas. Para santos y citas suaves.

## Origen de la imagen: descargar vs. generar

Cada pieza declara `arte: { fuente: "descarga" | "ia", archivo, credito | prompt, licencia }`.

- **Descargar (procedencia clara)** cuando el sujeto es un santo real, una escena histórica o una
  obra famosa: Wikimedia Commons y colecciones abiertas de museos. Sólo se acepta dominio público,
  CC0 o CC BY verificable, con autor, título, URL y licencia guardados junto al archivo. Se descarta
  toda obra marcada como IA; no se intenta adivinar el origen de imágenes de la web general.
- **Generar con IA** cuando se necesita una atmósfera/composición que no existe (escritorio a la
  luz de vela, manos trabajando la madera, capilla en penumbra) o para adaptar/extender un fondo.
  El texto va por encima después.
- **Guardarraíl:** no representar a un **santo real concreto** con una imagen IA dudosa ni pasar
  una imagen IA por obra histórica auténtica. Para figuras canónicas, preferir arte real.

## Variación obligatoria

- Un lote de tres prioriza dos obras públicas/curadas y deja como máximo una escena IA propia;
  el historial compensa el origen menos usado para no convertir ninguno en norma absoluta.
- Cada pieza declara una paleta (`color_obra`, piedra fría, vino/negro, oliva/pergamino o cálida)
  y una composición principal. No se repiten las de los dos posts previos.
- Los desarrollos alternan entre editorial superior, manifiesto centrado, bloque inferior,
  contraste y mapa conceptual. Un mapa sólo se usa cuando hay proceso, relación o dos caminos.

## Nota operativa

Sin imagen adjunta, la pieza usa un fondo **procedural** (chiaroscuro cálido + grano) para no
quedar en gradiente plano. Apenas se suelta una obra en `assets/arte/` y se referencia en la
pieza, el tratamiento la integra al estilo de las referencias.
