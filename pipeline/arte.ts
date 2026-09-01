/** Resuelve el plan de arte de una pieza.
 *
 * Una pieza final siempre tiene arte real: una obra pública, una imagen IA o un
 * asset curado. Soporta una imagen única, una obra recorrida por crops y una
 * imagen distinta por slide. */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { imagen as generarImagenOpenAI } from "./openai.ts";
import { descargarObra } from "./arte-descarga.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTE = join(ROOT, "assets", "arte");
const RECORTES_POR_DEFECTO = ["50% 42%", "32% 32%", "68% 34%", "38% 62%", "64% 64%", "50% 52%", "50% 50%", "50% 50%"];

const ESTILO_IA =
  "imagen editorial sobria y fílmica, con la paleta y la luz pedidas por la dirección visual; " +
  "SIN texto, SIN palabras, SIN letras; sin rostros de santos identificables; " +
  "composición vertical 4:5 con espacio negativo coherente con la composición del texto.";

export type FuenteArte = "descarga" | "ia" | "curada";
export type ModoArte = "unica" | "recorrida" | "por_slide";

export interface PlanBaseArte {
  fuente: FuenteArte;
  query?: string;
  autor?: string;
  obra?: string;
  prompt?: string;
  archivo?: string;
  posicion?: string;
}

export interface ArtePlan extends Partial<PlanBaseArte> {
  modo?: ModoArte;
  principal?: PlanBaseArte;
  recortes?: string[];
  slides?: PlanBaseArte[];
}

interface PlanNormalizado {
  modo: ModoArte;
  principal?: PlanBaseArte;
  recortes: string[];
  slides?: PlanBaseArte[];
}

function esPosicionValida(valor: string): boolean {
  const match = valor.trim().match(/^(\d{1,3})%\s+(\d{1,3})%$/);
  return !!match && Number(match[1]) <= 100 && Number(match[2]) <= 100;
}

function validarBase(plan: PlanBaseArte, etiqueta: string): void {
  if (!plan || !["descarga", "ia", "curada"].includes(plan.fuente)) {
    throw new Error(`${etiqueta} requiere fuente descarga, ia o curada.`);
  }
  if (plan.fuente === "descarga" && (!plan.query || !plan.autor || !plan.obra)) {
    throw new Error(`${etiqueta}.descarga requiere query, autor y obra concretos.`);
  }
  if (plan.fuente === "ia" && !plan.prompt) throw new Error(`${etiqueta}.ia sin prompt.`);
  if (plan.fuente === "curada" && !plan.archivo) throw new Error(`${etiqueta}.curada sin archivo.`);
  if (plan.posicion && !esPosicionValida(plan.posicion)) {
    throw new Error(`${etiqueta}.posicion debe tener formato "50% 50%".`);
  }
}

/** Valida el contrato que devuelve el cerebro antes de gastar una imagen o descargar arte. */
export function normalizarPlanArte(plan: ArtePlan | undefined, cantidadSlides: number): PlanNormalizado {
  if (!plan) throw new Error("Falta arte_plan; una pieza final requiere imagen.");

  // Compatibilidad con lotes anteriores: { fuente, query/prompt/archivo }.
  if (!plan.modo) {
    validarBase(plan as PlanBaseArte, "arte_plan");
    return { modo: "unica", principal: plan as PlanBaseArte, recortes: [] };
  }

  if (plan.modo === "unica") {
    if (!plan.principal) throw new Error("arte_plan.unica requiere principal.");
    validarBase(plan.principal, "arte_plan.principal");
    return { modo: "unica", principal: plan.principal, recortes: [] };
  }

  if (plan.modo === "recorrida") {
    if (!plan.principal) throw new Error("arte_plan.recorrida requiere principal.");
    validarBase(plan.principal, "arte_plan.principal");
    const recortes = plan.recortes || [];
    if (recortes.length !== cantidadSlides) {
      throw new Error(`arte_plan.recorrida requiere ${cantidadSlides} recortes, uno por slide.`);
    }
    if (!recortes.every(esPosicionValida)) throw new Error("arte_plan.recorrida tiene un recorte inválido.");
    return { modo: "recorrida", principal: plan.principal, recortes };
  }

  if (plan.modo === "por_slide") {
    const slides = plan.slides || [];
    if (slides.length !== cantidadSlides) {
      throw new Error(`arte_plan.por_slide requiere ${cantidadSlides} planes, uno por slide.`);
    }
    slides.forEach((slide, index) => validarBase(slide, `arte_plan.slides[${index}]`));
    const ia = slides.filter((slide) => slide.fuente === "ia").length;
    if (ia > 1) throw new Error("arte_plan.por_slide permite como máximo una imagen IA por pieza.");
    return { modo: "por_slide", recortes: [], slides };
  }

  throw new Error(`Modo de arte no reconocido: ${(plan as any).modo}`);
}

async function materializarArte(plan: PlanBaseArte, piezaId: string, sufijo = ""): Promise<any> {
  if (plan.fuente === "curada") {
    return { fuente: "curada", archivo: plan.archivo, verificado: false };
  }

  if (plan.fuente === "descarga") {
    const obra = await descargarObra(plan.query!);
    if (!obra.procedencia.autor || !obra.procedencia.titulo) {
      throw new Error(`La obra encontrada para "${plan.autor} — ${plan.obra}" no conserva autor y título verificables.`);
    }
    const rel = `descargado/${piezaId}${sufijo}.${obra.ext}`;
    await mkdir(join(ARTE, "descargado"), { recursive: true });
    await writeFile(join(ARTE, rel), obra.buffer);
    await writeFile(join(ARTE, rel + ".json"), JSON.stringify({ ...obra.procedencia, verificado: false }, null, 2) + "\n");
    return { fuente: "descarga", archivo: rel, credito: obra.procedencia.titulo, licencia: obra.procedencia.licencia, verificado: false };
  }

  const prompt = `${plan.prompt}. ${ESTILO_IA}`;
  const png = await generarImagenOpenAI(prompt);
  const rel = `generado/${piezaId}${sufijo}.png`;
  await mkdir(join(ARTE, "generado"), { recursive: true });
  await writeFile(join(ARTE, rel), png);
  await writeFile(join(ARTE, rel + ".json"), JSON.stringify({ fuente: "ia", modelo: process.env.IMAGEN_MODEL || "gpt-image-1", prompt, licencia: "Generada por IA (no es obra histórica)", verificado: false }, null, 2) + "\n");
  return { fuente: "ia", archivo: rel, prompt, verificado: false };
}

/** Mutará pieza.arte y/o slide.arte y escribirá los assets necesarios. */
export async function resolverArte(pieza: any): Promise<any> {
  const plan = normalizarPlanArte(pieza.arte_plan, pieza.slides?.length || 1);

  if (plan.modo === "unica") {
    pieza.arte = await materializarArte(plan.principal!, pieza.id);
    return pieza;
  }

  if (plan.modo === "recorrida") {
    const arte = await materializarArte(plan.principal!, pieza.id);
    pieza.arte = arte;
    pieza.slides.forEach((slide: any, index: number) => {
      slide.arte = { ...arte, posicion: plan.recortes[index] || RECORTES_POR_DEFECTO[index % RECORTES_POR_DEFECTO.length] };
    });
    return pieza;
  }

  for (let index = 0; index < plan.slides!.length; index++) {
    const arte = await materializarArte(plan.slides![index], pieza.id, `-slide-${String(index + 1).padStart(2, "0")}`);
    pieza.slides[index].arte = { ...arte, ...(plan.slides![index].posicion ? { posicion: plan.slides![index].posicion } : {}) };
  }
  return pieza;
}
