import assert from "node:assert/strict";
import test from "node:test";
import { normalizarPlanArte, resolverArte } from "../pipeline/arte.ts";
import { origenDesdeArte, cuotasOrigenLote } from "../pipeline/direccion-visual.ts";

test("no permite renderizar una pieza final sin un plan de arte", async () => {
  await assert.rejects(
    () => resolverArte({ id: "prueba-sin-arte" }),
    /requiere imagen/,
  );
});

test("una obra recorrida completa crops faltantes sin alterar la obra", () => {
  const plan = normalizarPlanArte({
    modo: "recorrida",
    principal: { fuente: "curada", archivo: "curada/obra.jpg" },
    recortes: ["50% 50%"],
  }, 2);
  assert.deepEqual(plan.recortes, ["50% 50%", "50% 50%"]);
});

test("un plan por slide incompleto se vuelve una recorrida de su fuente verificada", () => {
  const plan = normalizarPlanArte({
    modo: "por_slide",
    slides: [{ fuente: "curada", archivo: "curada/obra.jpg" }],
  }, 3);
  assert.equal(plan.modo, "recorrida");
  assert.equal(plan.principal?.archivo, "curada/obra.jpg");
  assert.equal(plan.recortes.length, 3);
});

test("las imágenes distintas limitan el costo a una sola generación IA", () => {
  assert.throws(
    () => normalizarPlanArte({
      modo: "por_slide",
      slides: [
        { fuente: "ia", prompt: "escena uno" },
        { fuente: "ia", prompt: "escena dos" },
      ],
    }, 2),
    /máximo una imagen IA/,
  );
});

test("una descarga exige autor y obra concretos", () => {
  assert.throws(
    () => normalizarPlanArte({
      modo: "unica",
      principal: { fuente: "descarga", query: "pintura religiosa" },
    }, 1),
    /autor y obra concretos/,
  );
});

test("una dirección de obra no acepta mezclar arte público e IA en la misma pieza", () => {
  assert.equal(origenDesdeArte({
    modo: "por_slide",
    slides: [{ fuente: "descarga", query: "obra" }, { fuente: "ia", prompt: "escena" }],
  }), null);
});

test("una tanda de tres prioriza dos obras públicas antes que una escena IA propia", () => {
  assert.deepEqual(cuotasOrigenLote([], 3), ["obra", "obra", "ia"]);
});
