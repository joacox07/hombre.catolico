# Assets

## Arte (`assets/arte/`)

Solo **arte de dominio público**, con procedencia registrada. Por cada obra, un archivo
`.json` hermano con los metadatos:

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
