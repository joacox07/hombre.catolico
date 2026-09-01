import assert from "node:assert/strict";
import test from "node:test";
import { crearControlCalidad, piezaAprobable, registrarRenderEnCalidad } from "../pipeline/calidad.ts";

const ficha = {
  id: "fuente-verificada", tipo: "Escritura", titulo_fuente: "Fuente", referencia_exacta: "Ref",
  fragmento_textual: "Una cita textual suficientemente larga y comprobable.",
  afirmacion_que_sostiene: "Una afirmación respaldada.", clasificacion_doctrinal: { nivel: 1, etiqueta: "Escritura" }, verificado: true,
};

const piezaBase = {
  id: "pieza-prueba", fuentes: ["fuente-verificada"],
  caption: "«Una cita textual suficientemente larga y comprobable.»",
  arte: { fuente: "descarga", archivo: "descargado/obra.jpg", verificado: true }, slides: [],
};

test("una cita alterada bloquea la calidad aunque el auditor no encuentre riesgos", async () => {
  const control = await crearControlCalidad(
    { ...piezaBase, caption: "«Una cita textual suficientemente larga y adulterada.»" }, [ficha],
    { revisar: async () => '{"afirmaciones":[]}' },
  );
  assert.equal(control.candados.citas_literales, false);
  assert.equal(control.bloquea_aprobacion, true);
});

test("una afirmación sin respaldo claro exige contraste humano", async () => {
  const control = await crearControlCalidad(piezaBase, [ficha], {
    revisar: async () => JSON.stringify({ afirmaciones: [{
      texto: "Una conclusión que la ficha no sostiene.", fichas: [], riesgo: "alto", respaldo: "incierto", nota: "Falta contexto.",
    }] }),
  });
  assert.equal(control.revision_humana_requerida, true);
  assert.equal(control.bloquea_aprobacion, true);
  assert.equal(control.alertas.some((a) => a.codigo === "afirmaciones_sin_respaldo_claro"), true);
});

test("un tema sensible verde sólo se aprueba tras el render y por acción humana", async () => {
  const control = await crearControlCalidad(piezaBase, [ficha], { sensible: true, revisar: async () => '{"afirmaciones":[]}' });
  const pieza = { ...piezaBase, control_calidad: registrarRenderEnCalidad(control, true) };
  assert.equal(pieza.control_calidad.revision_humana_requerida, true);
  assert.equal(piezaAprobable(pieza), true);
});

test("un fallo de render vuelve a bloquear una pieza antes verde", async () => {
  const control = await crearControlCalidad(piezaBase, [ficha], { revisar: async () => '{"afirmaciones":[]}' });
  const pieza = { ...piezaBase, control_calidad: registrarRenderEnCalidad(control, false, "Texto fuera del canvas.") };
  assert.equal(piezaAprobable(pieza), false);
  assert.equal(pieza.control_calidad.alertas.some((a) => a.codigo === "render_tecnico_fallido"), true);
});
