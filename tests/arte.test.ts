import assert from "node:assert/strict";
import test from "node:test";
import { normalizarPlanArte, resolverArte } from "../pipeline/arte.ts";

test("no permite renderizar una pieza final sin un plan de arte", async () => {
  await assert.rejects(
    () => resolverArte({ id: "prueba-sin-arte" }),
    /requiere imagen/,
  );
});

test("una obra recorrida exige un crop válido por slide", () => {
  assert.throws(
    () => normalizarPlanArte({
      modo: "recorrida",
      principal: { fuente: "curada", archivo: "curada/obra.jpg" },
      recortes: ["50% 50%"],
    }, 2),
    /2 recortes/,
  );
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
