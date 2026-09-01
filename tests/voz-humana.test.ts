import assert from "node:assert/strict";
import test from "node:test";
import { aplicarEdicionDeVoz, auditarVozHumana } from "../pipeline/voz-humana.ts";

test("detecta tics de redacción automática en español sin tocar la doctrina", () => {
  const hallazgos = auditarVozHumana("No se trata de obedecer, sino de transformá tu vida. Descubrí cómo.");
  assert.deepEqual(hallazgos.map((h) => h.patron), ["contraste_formulaico", "gancho_generico"]);
});

test("la edición de voz sólo modifica campos textuales", () => {
  const original = {
    titulo: "Antes", caption: "Texto", fuentes: ["ficha"], direccion_visual: { paleta: "calida" },
    slides: [{ tipo: "contenido", disposicion: "contraste", cuerpo: "Antes", mapa: { centro: "A", pasos: ["B", "C"] } }],
  };
  const salida = aplicarEdicionDeVoz(original, { titulo: "Después", caption: "Texto mejor", slides: [{ cuerpo: "Después" }] });
  assert.equal(salida.titulo, "Después");
  assert.equal(salida.slides[0].cuerpo, "Después");
  assert.deepEqual(salida.fuentes, ["ficha"]);
  assert.equal(salida.slides[0].disposicion, "contraste");
  assert.deepEqual(salida.slides[0].mapa, { centro: "A", pasos: ["B", "C"] });
});
