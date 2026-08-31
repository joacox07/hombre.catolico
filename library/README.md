# Biblioteca de fuentes

Cada archivo en `fuentes/` es una **ficha**: una fuente católica aprobada. La biblioteca
cumple dos funciones a la vez:

1. **Corpus de recuperación** — de acá saca el generador el material para escribir. La IA
   **no** investiga por su cuenta qué enseña la Iglesia: trabaja solo con estas fichas.
2. **Verdad para verificar citas** — toda cita de una pieza tiene que aparecer **textual** en
   el `fragmento_textual` de una ficha. Si no está, no se publica. Así se evitan las citas
   apócrifas o mal atribuidas.

Meta inicial: **50-80 fichas** cubriendo Escritura, Catecismo, Magisterio, Derecho canónico
(cuando corresponda), Padres, Doctores y santos, y autores espirituales.

## Formato

Fichas en JSON, validadas contra `schema.json`. Campos:

| Campo | Qué es |
|-------|--------|
| `id` | identificador único, en kebab-case |
| `tipo` | Escritura · Catecismo · Magisterio · Derecho · Padres · Doctores/Santos · Autores espirituales · Opinión |
| `titulo_fuente` | obra o documento (p. ej. "Catecismo de la Iglesia Católica") |
| `autor` | autor si aplica |
| `referencia_exacta` | cita puntual (p. ej. "Ef 5,25"; "CIC 1601") |
| `enlace` | URL a la fuente oficial |
| `fragmento_textual` | el texto **exacto y verbatim** que se puede citar |
| `traduccion` | para Escritura: qué versión/traducción (importa por derechos y exactitud) |
| `afirmacion_que_sostiene` | qué se puede afirmar apoyándose en esta ficha |
| `clasificacion_doctrinal` | nivel 1-7 + etiqueta (ver `manual/02-doctrina-y-opinion.md`) |
| `contexto` | contexto necesario para no citar fuera de lugar |
| `temas_asociados` | temas del backlog con los que se puede usar |
| `pilares` | Fe · Virtud · Deber · Familia |
| `santos_asociados` | santos vinculados, si aplica |
| `verificado` | `true` solo cuando una persona confirmó el texto y la referencia |
| `nota_verificacion` | qué falta confirmar (traducción, edición, verbatim) |

## Responsabilidad de curaduría

**La calidad de la biblioteca es el cuello de botella real del proyecto.** La curaduría y
la validación doctrinal final son responsabilidad de una persona. Las fichas semilla vienen
con `verificado: false`: hay que confirmar el texto exacto y la traducción antes de usarlas
en producción. El sistema **no** trata como citable un `fragmento_textual` de una ficha con
`verificado: false` (esa comprobación se implementa en la Fase 1).

## Sobre la traducción de la Escritura

La versión importa por exactitud y por derechos. Versiones en dominio público en español
(p. ej. Torres Amat, Reina-Valera antiguas) se pueden citar libremente; otras modernas
(Nácar-Colunga, etc.) tienen derechos. Definir una versión de referencia y registrarla en
`traduccion`. Las semillas dejan esto marcado para que lo decida la persona que cura.
