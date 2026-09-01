/** Revisión de voz: patrones editoriales de español rioplatense, no evasión de detectores. */
import { chat } from "./texto.ts";

export interface HallazgoVoz {
  patron: string;
  detalle: string;
}

const PATRONES: Array<{ patron: string; detalle: string; re: RegExp }> = [
  { patron: "contraste_formulaico", detalle: "contraste prefabricado", re: /\bno\s+(?:se\s+trata|es)\s+de\b[^.!?]{0,100}\bsino\b/gi },
  { patron: "gancho_generico", detalle: "promesa o apertura intercambiable", re: /\b(?:descubr[ií]\s+c[oó]mo|transforma\s+tu\s+vida|marca\s+un\s+antes\s+y\s+un\s+despu[eé]s)\b/gi },
  { patron: "relleno_ia", detalle: "relleno retórico", re: /\b(?:en\s+el\s+mundo\s+(?:actual|de\s+hoy)|cabe\s+destacar|es\s+un\s+recordatorio\s+de|en\s+definitiva)\b/gi },
  { patron: "mandato_vacio", detalle: "mandato de poder sin acción concreta", re: /\b(?:s[eé]\s+imparable|domin[aá]|conquist[aá])\b/gi },
  { patron: "adjetivo_inflado", detalle: "adjetivo grandilocuente sin prueba", re: /\b(?:crucial|pivotal|trascendental|profund[oa]|esencial)\b/gi },
];

export function auditarVozHumana(texto: string): HallazgoVoz[] {
  const hallazgos: HallazgoVoz[] = [];
  for (const regla of PATRONES) {
    const coincidencias = texto.match(regla.re) || [];
    for (const _ of coincidencias) hallazgos.push({ patron: regla.patron, detalle: regla.detalle });
  }
  return hallazgos;
}

function textoDePieza(pieza: any): string {
  const slides = Array.isArray(pieza?.slides) ? pieza.slides : [];
  return [
    pieza?.titulo,
    pieza?.caption,
    ...slides.flatMap((slide: any) => [slide?.kicker, slide?.titulo, slide?.subtitulo, slide?.cuerpo, slide?.cta]),
  ].filter((v): v is string => typeof v === "string").join("\n");
}

/** Conserva estructura, fuentes, composición y clasificación; sólo acepta campos de redacción. */
export function aplicarEdicionDeVoz(pieza: any, edicion: any): any {
  if (!edicion || !Array.isArray(edicion.slides) || edicion.slides.length !== pieza.slides?.length) {
    throw new Error("la revisión de voz no devolvió los mismos slides");
  }
  const salida = structuredClone(pieza);
  if (typeof edicion.titulo === "string") salida.titulo = edicion.titulo;
  if (typeof edicion.caption === "string") salida.caption = edicion.caption;
  const campos = ["kicker", "titulo", "subtitulo", "cuerpo", "cta"];
  salida.slides.forEach((slide: any, indice: number) => {
    const revisado = edicion.slides[indice] || {};
    for (const campo of campos) if (typeof revisado[campo] === "string") slide[campo] = revisado[campo];
  });
  return salida;
}

export async function humanizarPieza(pieza: any, guia: string): Promise<any> {
  const inicial = textoDePieza(pieza);
  if (!auditarVozHumana(inicial).length) return pieza;
  const system = [
    "Sos el editor final de voz de @hombre.catolico.",
    "Reescribís español rioplatense para que suene escrito por un hermano formado, no por un asistente.",
    "No inventes ningún hecho, cita, ejemplo personal, fuente ni afirmación doctrinal.",
    "Conservá cantidad y orden de slides. No cambies tipo, disposición, mapa, fuentes, clasificación ni plan de arte.",
    "Devolvé SOLO JSON: {titulo, caption, slides:[{kicker,titulo,subtitulo,cuerpo,cta}]}. Incluí un objeto por cada slide, aunque no cambie.",
    "\n=== GUÍA ===\n" + guia,
  ].join("\n");
  const editada = JSON.parse(await chat(system, JSON.stringify(pieza), { json: true }));
  const salida = aplicarEdicionDeVoz(pieza, editada);
  const restantes = auditarVozHumana(textoDePieza(salida));
  if (restantes.length > 1) throw new Error(`la revisión de voz mantiene tics: ${restantes.map((h) => h.patron).join(", ")}`);
  return salida;
}
