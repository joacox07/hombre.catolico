import assert from "node:assert/strict";
import test from "node:test";
import { buscarCorrida } from "../api/_lib/github.ts";

test("encuentra sólo la corrida móvil solicitada", () => {
  const corrida = buscarCorrida("movil-abc", [
    { display_title: "Lote móvil movil-otra", status: "completed", conclusion: "success", html_url: "otra" },
    { display_title: "Lote móvil movil-abc", status: "in_progress", conclusion: null, html_url: "correcta" },
  ]);

  assert.deepEqual(corrida, { estado: "in_progress", resultado: null, url: "correcta" });
});

test("informa cuando la corrida aún no aparece en GitHub", () => {
  assert.equal(buscarCorrida("movil-abc", []), null);
});

test("no confunde una solicitud con otra que comparte prefijo", () => {
  assert.equal(buscarCorrida("movil-abc", [
    { display_title: "Lote móvil movil-abc-extra", status: "completed", conclusion: "success", html_url: "otra" },
  ]), null);
});
