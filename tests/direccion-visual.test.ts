import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  cuotasOrigenLote, normalizarDireccionVisual, validarComposiciones,
} from "../pipeline/direccion-visual.ts";

const direccion = normalizarDireccionVisual({
  origen_arte: "obra", paleta: "piedra_fria", composicion_principal: "contraste",
});

const slides = [
  { tipo: "portada", titulo: "Portada" },
  { tipo: "contenido", disposicion: "editorial_superior", titulo: "Idea uno", cuerpo: "Texto" },
  { tipo: "contenido", disposicion: "contraste", titulo: "Idea dos", cuerpo: "Texto" },
  { tipo: "contenido", disposicion: "mapa_conceptual", titulo: "Idea tres", cuerpo: "Texto", mapa: { centro: "Libertad", pasos: ["Elegir", "Perseverar"] } },
  { tipo: "contenido", disposicion: "bloque_inferior", titulo: "Idea cuatro", cuerpo: "Texto" },
  { tipo: "cierre", fuentes: ["Catecismo de la Iglesia Católica — libertad"] },
];

test("la dirección visual exige tres composiciones sin repetir consecutivamente", () => {
  assert.doesNotThrow(() => validarComposiciones(slides, direccion));
  assert.throws(() => validarComposiciones([
    slides[0], slides[1], { ...slides[2], disposicion: "editorial_superior" }, slides[3], slides[4], slides[5],
  ], direccion), /consecutivos/);
});

test("el mapa conceptual requiere relaciones explícitas", () => {
  assert.throws(() => validarComposiciones([
    slides[0], slides[1], slides[2], { ...slides[3], mapa: { centro: "Libertad", pasos: [] } }, slides[4], slides[5],
  ], direccion), /mapa_conceptual/);
});

test("las cuotas de un lote de tres siempre mezclan obra e IA", () => {
  const cuotas = cuotasOrigenLote([], 3);
  assert.ok(cuotas.includes("obra"));
  assert.ok(cuotas.includes("ia"));
});

test("el render oculta la fuente técnica en desarrollo y la conserva sólo en el cierre", () => {
  const scope: any = { globalThis: {} };
  vm.runInNewContext(readFileSync(new URL("../templates/render.js", import.meta.url), "utf8"), scope);
  const pieza = {
    direccion_visual: direccion,
    arte: { archivo: "curada/obra.jpg" },
    slides: [
      { tipo: "contenido", disposicion: "contraste", titulo: "La idea", cuerpo: "La explicación", fuente: "CIC 2339 · Nivel 2" },
      { tipo: "cierre", titulo: "Cierre", cuerpo: "Texto", fuentes: ["Catecismo de la Iglesia Católica — castidad y dominio de sí"] },
    ],
  };
  const desarrollo = scope.globalThis.HC.slideHTML(pieza, 0);
  const cierre = scope.globalThis.HC.slideHTML(pieza, 1);
  assert.ok(desarrollo.includes("compo-contraste"));
  assert.ok(!desarrollo.includes("CIC 2339"));
  assert.ok(cierre.includes("Catecismo de la Iglesia Católica"));
});
