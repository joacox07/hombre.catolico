/**
 * Recuperación — junta las fichas aprobadas relevantes a uno o más temas.
 * El empleado escribe SOLO con lo que devuelve esto (no inventa doctrina).
 *
 * CLI:  tsx pipeline/recuperacion.ts <temaId> [temaId...]
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import type { Backlog, TemaBacklog } from "./tipos.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTES = join(ROOT, "library", "fuentes");

export interface Ficha {
  id: string;
  tipo: string;
  titulo_fuente: string;
  autor?: string;
  referencia_exacta: string;
  fragmento_textual: string;
  afirmacion_que_sostiene: string;
  clasificacion_doctrinal: { nivel: number; etiqueta: string };
  contexto?: string;
  temas_asociados?: string[];
  verificado: boolean;
  nota_verificacion?: string;
  [k: string]: unknown;
}

export async function cargarFichas(): Promise<Ficha[]> {
  const files = (await readdir(FUENTES)).filter((f) => f.endsWith(".json"));
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(FUENTES, f), "utf8")) as Ficha));
}

/** Fichas relevantes a un tema: las sugeridas + las que lo listan en temas_asociados. */
export async function recuperar(temaIds: string[]): Promise<Record<string, Ficha[]>> {
  const backlog = JSON.parse(await readFile(join(ROOT, "data", "backlog.json"), "utf8")) as Backlog;
  const fichas = await cargarFichas();
  const idToTema = new Map(backlog.temas.map((t: TemaBacklog) => [t.id, t]));

  const out: Record<string, Ficha[]> = {};
  for (const temaId of temaIds) {
    const tema = idToTema.get(temaId);
    const sugeridas = new Set(tema?.fuentes_sugeridas || []);
    const rel = fichas.filter(
      (fi) => sugeridas.has(fi.id) || (fi.temas_asociados || []).includes(temaId),
    );
    out[temaId] = rel;
  }
  return out;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const temas = process.argv.slice(2);
  if (temas.length === 0) {
    console.error("Uso: tsx pipeline/recuperacion.ts <temaId> [temaId...]");
    process.exit(1);
  }
  const res = await recuperar(temas);
  for (const [tema, fichas] of Object.entries(res)) {
    console.log(`\n=== ${tema} → ${fichas.length} ficha(s) ===`);
    for (const fi of fichas) {
      const flag = fi.verificado ? "✓ verificada" : "⚠ SIN verificar (no citable en producción)";
      console.log(`  [${fi.id}] ${fi.referencia_exacta} · nivel ${fi.clasificacion_doctrinal.nivel} · ${flag}`);
    }
  }
  console.log("\n--- JSON ---");
  console.log(JSON.stringify(res, null, 2));
}
