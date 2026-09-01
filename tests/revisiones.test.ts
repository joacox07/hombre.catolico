import assert from "node:assert/strict";
import test from "node:test";
import { aplicarRevision, revisionVacia, validarRevision } from "../api/_lib/revisiones.js";

test("pedir cambios o descartar obliga a explicar el motivo", () => {
  assert.throws(() => validarRevision({ pieza_id: "pieza", decision: "cambios", comentario: "", version: "sha" }), /obligatorio/);
  assert.throws(() => validarRevision({ pieza_id: "pieza", decision: "descartar", comentario: "", version: "sha" }), /obligatorio/);
});

test("una revisión conserva estado actual y cronología por pieza", () => {
  const inicial = revisionVacia("2026-W36");
  const conCambios = aplicarRevision(inicial, { lote_id: "2026-W36", pieza_id: "pieza", decision: "cambios", comentario: "Ajustar fuente." }, "2026-09-01T12:00:00.000Z");
  const aprobada = aplicarRevision(conCambios, { lote_id: "2026-W36", pieza_id: "pieza", decision: "aprobar", comentario: "Corregido." }, "2026-09-01T13:00:00.000Z");
  assert.equal(aprobada.revisiones.pieza.decision, "aprobar");
  assert.equal(aprobada.eventos.length, 2);
  assert.equal(aprobada.eventos[0].decision, "cambios");
});

test("la versión del cliente se conserva para que la API detecte conflictos", () => {
  assert.deepEqual(validarRevision({ pieza_id: "pieza-correcta", decision: "aprobar", comentario: "", version: "sha-actual" }), {
    pieza_id: "pieza-correcta", decision: "aprobar", comentario: "", version: "sha-actual",
  });
});
