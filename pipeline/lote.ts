/**
 * Ensamble del lote semanal + actualización de la memoria.
 * Toma una spec del lote (piezas ya escritas por el empleado en data/piezas/) y:
 *   1. escribe data/lotes/lote-<semana>.json (lo que lee el panel),
 *   2. registra cada pieza en data/registro.json (estado en_revision) → memoria anti-repetición,
 *   3. marca los temas del backlog como "generado",
 *   4. actualiza data/lotes/index.json (más nuevo primero).
 *
 * CLI:  tsx pipeline/lote.ts <spec.json>
 * spec = { semana:"2026-W36", nombre?, piezas:[{ ref:"/data/piezas/x.json", fecha_propuesta, estado?, revisor? }] }
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import type { Backlog, Registro, RegistroPieza } from "./tipos.ts";
import { archivoLote, idLote } from "./lote-id.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = async <T>(rel: string): Promise<T> => JSON.parse(await readFile(join(ROOT, rel), "utf8")) as T;
const escribir = (rel: string, obj: unknown) => writeFile(join(ROOT, rel), JSON.stringify(obj, null, 2) + "\n");

interface SpecPieza { ref: string; fecha_propuesta: string; estado?: string; revisor?: unknown; }
interface Spec { semana: string; id?: string; nombre?: string; piezas: SpecPieza[]; }

export async function ensamblarLote(spec: Spec): Promise<string> {
  const registro = await leer<Registro>("data/registro.json");
  const backlog = await leer<Backlog>("data/backlog.json");
  const ahora = new Date().toISOString();
  const loteId = idLote(spec.semana, spec.id);

  // Construir el lote y registrar cada pieza.
  const piezasLote = [];
  for (const sp of spec.piezas) {
    const relPieza = sp.ref.replace(/^\//, "");
    if (!existsSync(join(ROOT, relPieza))) throw new Error(`No existe la pieza: ${sp.ref}`);
    const pieza = await leer<any>(relPieza);
    // El id de la pieza ES el id del tema del backlog (convención del sistema).
    const temaId = pieza.id;

    piezasLote.push({
      ref: sp.ref,
      fecha_propuesta: sp.fecha_propuesta,
      estado: sp.estado || "en_revision",
      revisor: sp.revisor,
    });

    // Memoria: append al registro (evita repetir tema/fuentes).
    const entrada: RegistroPieza = {
      id: `${pieza.id}-${loteId}`,
      tema: temaId,
      pilar: pieza.pilar,
      santos: pieza.santos || (pieza.slides ? [] : []),
      formato: pieza.tipo,
      fuentes: pieza.fuentes || [],
      gancho: pieza.titulo || pieza.tema,
      nivel: pieza.nivel,
      fecha: ahora,
      estado: sp.estado || "en_revision",
    };
    registro.piezas.push(entrada);

    // Marcar el tema del backlog como generado.
    const t = backlog.temas.find((x) => x.id === temaId);
    if (t && t.estado === "backlog") t.estado = "generado";
  }

  const file = archivoLote(loteId);
  await mkdir(join(ROOT, "data", "lotes"), { recursive: true });
  await escribir(file, {
    id: loteId,
    nombre: spec.nombre || `Lote ${spec.semana}`,
    semana: spec.semana,
    generado: ahora.slice(0, 10),
    piezas: piezasLote,
  });

  // Índice de lotes (más nuevo primero).
  let index: { lotes: Array<{ id?: string; file: string; nombre: string; semana: string; generado: string }> } = { lotes: [] };
  if (existsSync(join(ROOT, "data/lotes/index.json"))) index = await leer("data/lotes/index.json");
  index.lotes = index.lotes.filter((l) => (l.id || l.semana) !== loteId);
  index.lotes.unshift({ id: loteId, file: "/" + file, nombre: spec.nombre || `Lote ${spec.semana}`, semana: spec.semana, generado: ahora.slice(0, 10) });
  await escribir("data/lotes/index.json", index);

  // Persistir memoria + backlog.
  await escribir("data/registro.json", registro);
  await escribir("data/backlog.json", backlog);

  return file;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const specPath = process.argv[2];
  if (!specPath) { console.error("Uso: tsx pipeline/lote.ts <spec.json>"); process.exit(1); }
  const spec = JSON.parse(await readFile(resolve(specPath), "utf8")) as Spec;
  const file = await ensamblarLote(spec);
  console.log(`✓ Lote ensamblado: ${file}`);
  console.log(`  Registradas ${spec.piezas.length} pieza(s) en la memoria (data/registro.json).`);
}
