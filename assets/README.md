# Assets

## Arte (`assets/arte/`)

El pipeline guarda el arte de cada pieza acá, con procedencia en un `.json` hermano:
- `assets/arte/descargado/` — obras de **dominio público** bajadas por el pipeline (Wikimedia,
  etc.), con su procedencia y licencia.
- `assets/arte/generado/` — fondos **generados por IA** (`gpt-image-1`), con el **prompt**
  registrado. No son obra histórica; nunca se presentan como tal.
- Sueltas en `assets/arte/` — obras **curadas a mano** por vos.

La pieza decide su imagen con un `arte_plan` (`{ fuente: "descarga"|"ia"|"curada", query|prompt|archivo }`);
`pipeline/arte.ts` lo resuelve y setea `pieza.arte`. Formato del `.json` de procedencia:

```json
{
  "archivo": "de-la-tour-san-jose-carpintero.jpg",
  "titulo": "San José carpintero",
  "autor": "Georges de La Tour",
  "anio": "c. 1642",
  "museo": "Musée du Louvre, París",
  "fuente_url": "https://...",
  "licencia": "Dominio público",
  "verificado": false
}
```

Fuentes seguras de dominio público: Met Open Access, Rijksmuseum, National Gallery of Art
(open access), Getty Open Content, Web Gallery of Art, Wikimedia Commons.

Reglas: registrar autor, título, museo/procedencia y licencia de cada obra; no usar imágenes
sin verificar derechos; no pasar una imagen generada por IA como obra histórica auténtica.

## Fuentes tipográficas (`assets/fonts/`)

Colocar acá los `.woff2` de Cormorant Garamond y DM Sans para que el render sea reproducible
y no dependa de red. Ambas tienen licencias abiertas (SIL Open Font License) que permiten el
embebido. `templates/tokens.css` las referencia; si faltan, el stack de fallback mantiene la
pieza legible pero la tipografía no será la definitiva.

Archivos esperados:
- `CormorantGaramond-SemiBold.woff2`
- `CormorantGaramond-Medium.woff2`
- `DMSans-Regular.woff2`
- `DMSans-Medium.woff2`
