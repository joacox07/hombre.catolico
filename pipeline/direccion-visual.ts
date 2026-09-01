/** Dirección visual verificable para que la variedad no dependa sólo del prompt. */
import type { RegistroPieza } from "./tipos.js";

export const PALETAS_VISUALES = ["color_obra", "piedra_fria", "vino_negro", "oliva_pergamino", "calida"] as const;
export const COMPOSICIONES_DESARROLLO = [
  "editorial_superior", "manifiesto_central", "bloque_inferior", "contraste", "mapa_conceptual",
] as const;

export type PaletaVisual = typeof PALETAS_VISUALES[number];
export type ComposicionDesarrollo = typeof COMPOSICIONES_DESARROLLO[number];
export type OrigenVisual = "obra" | "ia";

export interface DireccionVisual {
  origen_arte: OrigenVisual;
  paleta: PaletaVisual;
  composicion_principal: ComposicionDesarrollo;
}

export interface MapaConceptual {
  centro: string;
  pasos: string[];
}

function incluye<T extends readonly string[]>(valores: T, valor: unknown): valor is T[number] {
  return typeof valor === "string" && (valores as readonly string[]).includes(valor);
}

export function normalizarDireccionVisual(valor: unknown): DireccionVisual {
  const d = valor as Partial<DireccionVisual> | undefined;
  if (!d || (d.origen_arte !== "obra" && d.origen_arte !== "ia")) {
    throw new Error("direccion_visual.origen_arte debe ser obra o ia.");
  }
  if (!incluye(PALETAS_VISUALES, d.paleta)) throw new Error("direccion_visual.paleta no es válida.");
  if (!incluye(COMPOSICIONES_DESARROLLO, d.composicion_principal)) {
    throw new Error("direccion_visual.composicion_principal no es válida.");
  }
  return d as DireccionVisual;
}

/** Corrige sólo metadatos visuales repetidos; no altera texto, doctrina ni arte. */
export function direccionAlternativa(
  slides: any[],
  direccion: DireccionVisual,
  excluidas: DireccionVisual[],
): DireccionVisual | null {
  const paleta = PALETAS_VISUALES.find((opcion) => !excluidas.some((d) => d.paleta === opcion));
  const composicion = slides
    .filter((slide) => slide?.tipo === "contenido")
    .map((slide) => slide.disposicion)
    .find((opcion) => incluye(COMPOSICIONES_DESARROLLO, opcion) && !excluidas.some((d) => d.composicion_principal === opcion));
  if (!paleta || !composicion) return null;
  return { ...direccion, paleta, composicion_principal: composicion };
}

/** Valida composición sin romper las piezas creadas antes de este contrato. */
export function validarComposiciones(slides: any[], direccion: DireccionVisual): void {
  const desarrollo = slides.filter((s) => s?.tipo === "contenido");
  if (desarrollo.length < 3) return;
  const composiciones = desarrollo.map((s) => s.disposicion);
  if (!composiciones.every((c) => incluye(COMPOSICIONES_DESARROLLO, c))) {
    throw new Error("Cada slide de desarrollo necesita una disposicion visual válida.");
  }
  if (new Set(composiciones).size < 3) {
    throw new Error("El carrusel necesita al menos tres composiciones de desarrollo distintas.");
  }
  if (composiciones.some((c, i) => i > 0 && c === composiciones[i - 1])) {
    throw new Error("No se puede repetir la misma composición en slides consecutivos.");
  }
  if (!composiciones.includes(direccion.composicion_principal)) {
    throw new Error("La composicion_principal debe usarse en al menos un slide de desarrollo.");
  }
  for (const slide of desarrollo) {
    if (slide.disposicion === "mapa_conceptual") {
      const mapa = slide.mapa as MapaConceptual | undefined;
      if (!mapa?.centro || !Array.isArray(mapa.pasos) || mapa.pasos.length < 2 || mapa.pasos.length > 3) {
        throw new Error("Un mapa_conceptual necesita centro y entre dos y tres pasos reales.");
      }
    }
  }
}

export function origenDesdeArte(plan: any): OrigenVisual | null {
  const bases = plan?.modo === "por_slide" ? plan.slides : [plan?.principal || plan];
  if (!Array.isArray(bases)) return null;
  const fuentes = bases.map((p) => p?.fuente);
  if (fuentes.length && fuentes.every((f) => f === "descarga" || f === "curada")) return "obra";
  if (fuentes.length && fuentes.every((f) => f === "ia")) return "ia";
  return null;
}

/** Alterna obra/IA por lote y compensa el sesgo acumulado del registro. */
export function cuotasOrigenLote(registro: RegistroPieza[], cantidad: number): OrigenVisual[] {
  const anteriores = registro.map((p) => p.direccion_visual?.origen_arte).filter(Boolean) as OrigenVisual[];
  let obras = anteriores.filter((o) => o === "obra").length;
  let ia = anteriores.filter((o) => o === "ia").length;
  const cuotas: OrigenVisual[] = [];
  for (let i = 0; i < cantidad; i++) {
    let siguiente: OrigenVisual;
    // En cada tanda de tres se priorizan dos piezas con arte de procedencia clara.
    // La escena IA propia queda como recurso expresivo, no como fondo por defecto.
    if (cantidad >= 3 && i < 2) siguiente = "obra";
    else if (cantidad >= 3 && i === 2) siguiente = "ia";
    else siguiente = obras <= ia ? "obra" : "ia";
    cuotas.push(siguiente);
    if (siguiente === "obra") obras++; else ia++;
  }
  return cuotas;
}

export function restriccionesVisuales(registro: RegistroPieza[]): DireccionVisual[] {
  return registro.slice(-2).map((p) => p.direccion_visual).filter(Boolean) as DireccionVisual[];
}
