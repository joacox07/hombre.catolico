# Estado editorial

Fuente de verdad de qué se hace, qué se hizo y cómo se balancea. En Fase 0 es JSON
versionado; en Fase 1-2 puede migrar a SQLite si conviene.

## Archivos

- `backlog.json` — banco de temas (arranca con las 30 publicaciones iniciales). Cada tema
  trae pilar, categoría editorial, formato sugerido, si es sensible, santos y fuentes sugeridas.
- `registro.json` — (se llena en Fase 1) piezas ya generadas/publicadas con su resultado.
- `muestras/` — piezas de ejemplo para probar plantillas y render sin correr el pipeline.

## Modelo de estados de una pieza

```
backlog → seleccionado → generado → en_revision
        → (aprobado | cambios | descartado)
        → programado → publicado
```

- `revision_humana: true` fuerza parada obligatoria en `en_revision` (temas sensibles).
- Nada pasa a `programado` sin `aprobado` explícito de una persona en el panel.

## Balance a controlar

Distribución editorial objetivo (ver `manual/04-formato-piezas.md`): 35% formación práctica,
25% virtudes y vida espiritual, 20% noviazgo/matrimonio/familia, 15% santos/fuentes/libros,
5% comunidad. El selector de temas (Fase 1) usa `registro.json` para no repetir y para
mantener este balance por pilar, formato, santo y nivel de profundidad.
