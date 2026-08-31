import assert from "node:assert/strict";
import test from "node:test";
import { idLote, archivoLote } from "../pipeline/lote-id.ts";

test("distingue dos corridas de la misma semana", () => {
  assert.equal(idLote("2026-W36", "1001"), "2026-W36-1001");
  assert.equal(idLote("2026-W36", "1002"), "2026-W36-1002");
});

test("conserva el formato de archivo de lote seguro", () => {
  assert.equal(archivoLote("2026-W36-1001"), "data/lotes/lote-2026-W36-1001.json");
});
