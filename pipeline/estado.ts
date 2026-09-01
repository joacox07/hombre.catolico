/**
 * Estado editorial — la "memoria" que el empleado consulta ANTES de elegir temas.
 * Lee backlog + registro y devuelve: candidatos disponibles, balance de la distribución,
 * santos y fuentes ya usados, y una sugerencia priorizada para no repetirse.
 *
 * CLI:  tsx pipeline/estado.ts [n]   → resumen legible + JSON (n = cuántos sugerir, def. 3)
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import {
  type Backlog, type Registro, type TemaBacklog,
  OBJETIVO_DISTRIBUCION, baldeDe, type Balde,
} from "./tipos.ts";
import { cuotasOrigenLote, restriccionesVisuales, type DireccionVisual, type OrigenVisual } from "./direccion-visual.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = async <T>(p: string): Promise<T> => JSON.parse(await readFile(join(ROOT, p), "utf8")) as T;

const ESTADOS_USADOS = new Set(["seleccionado", "generado", "en_revision", "aprobado", "programado", "publicado"]);

export interface Contexto {
  totalRegistrado: number;
  distribucionActual: Record<Balde, number>;
  deficitPorBalde: Record<Balde, number>;
  santosUsados: Record<string, number>;
  fuentesUsadas: Record<string, number>;
  temasUsados: string[];
  candidatos: TemaBacklog[];
  sugerencia: Array<{ tema: TemaBacklog; score: number; motivo: string }>;
  cuotas_origen_arte: OrigenVisual[];
  direcciones_recientes: DireccionVisual[];
}

export async function contextoSemanal(n = 3): Promise<Contexto> {
  const backlog = await leer<Backlog>("data/backlog.json");
  const registro = await leer<Registro>("data/registro.json");

  // Temas ya tocados (en registro, o marcados fuera de "backlog" en el propio backlog).
  const usadosRegistro = new Set(registro.piezas.filter((p) => p.estado !== "descartado").map((p) => p.tema));
  const usadosBacklog = new Set(backlog.temas.filter((t) => t.estado !== "backlog").map((t) => t.id));
  const temasUsados = [...new Set([...usadosRegistro, ...usadosBacklog])];

  // Distribución actual por balde.
  const conteoBalde = Object.fromEntries(Object.keys(OBJETIVO_DISTRIBUCION).map((b) => [b, 0])) as Record<Balde, number>;
  const santosUsados: Record<string, number> = {};
  const fuentesUsadas: Record<string, number> = {};
  const idToTema = new Map(backlog.temas.map((t) => [t.id, t]));
  for (const p of registro.piezas) {
    if (p.estado === "descartado") continue;
    const t = idToTema.get(p.tema);
    if (t) conteoBalde[baldeDe(t.categoria)]++;
    for (const s of p.santos || []) santosUsados[s] = (santosUsados[s] || 0) + 1;
    for (const f of p.fuentes || []) fuentesUsadas[f] = (fuentesUsadas[f] || 0) + 1;
  }
  const total = registro.piezas.filter((p) => p.estado !== "descartado").length || 0;
  const distribucionActual = Object.fromEntries(
    (Object.keys(conteoBalde) as Balde[]).map((b) => [b, total ? conteoBalde[b] / total : 0]),
  ) as Record<Balde, number>;
  const deficitPorBalde = Object.fromEntries(
    (Object.keys(conteoBalde) as Balde[]).map((b) => [b, OBJETIVO_DISTRIBUCION[b] - distribucionActual[b]]),
  ) as Record<Balde, number>;

  // Una generación sólo puede arrancar con una fuente prevista. Sin este filtro
  // el modelo termina produciendo un aviso interno en lugar de una publicación.
  const candidatos = backlog.temas.filter((t) =>
    t.estado === "backlog" && !temasUsados.includes(t.id) && (t.fuentes_sugeridas || []).length > 0,
  );

  // Puntaje: prioriza baldes en déficit, santos frescos y fuentes poco citadas.
  const sugerencia = candidatos
    .map((tema) => {
      const balde = baldeDe(tema.categoria);
      const scDeficit = deficitPorBalde[balde]; // + si el balde está flojo
      const scSanto = (tema.santos || []).reduce((acc, s) => acc - (santosUsados[s] || 0) * 0.15, 0);
      const scFuente = (tema.fuentes_sugeridas || []).reduce((acc, f) => acc - (fuentesUsadas[f] || 0) * 0.05, 0);
      const score = scDeficit + scSanto + scFuente;
      const motivo = `balde ${balde} (déficit ${(scDeficit * 100).toFixed(0)}%)` +
        (tema.santos?.length ? `, santo ${tema.santos.join("/")}` : "") +
        (tema.sensible ? ", SENSIBLE (revisión humana)" : "");
      return { tema, score, motivo };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);

  return {
    totalRegistrado: total, distribucionActual, deficitPorBalde, santosUsados, fuentesUsadas, temasUsados, candidatos, sugerencia,
    cuotas_origen_arte: cuotasOrigenLote(registro.piezas, n),
    direcciones_recientes: restriccionesVisuales(registro.piezas),
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] || 3);
  const ctx = await contextoSemanal(n);
  console.log("=== Estado editorial ===");
  console.log(`Piezas registradas: ${ctx.totalRegistrado} · candidatos libres: ${ctx.candidatos.length}`);
  console.log("\nDistribución (actual → objetivo):");
  for (const b of Object.keys(OBJETIVO_DISTRIBUCION) as Balde[]) {
    console.log(`  ${b.padEnd(26)} ${(ctx.distribucionActual[b] * 100).toFixed(0).padStart(3)}%  →  ${(OBJETIVO_DISTRIBUCION[b] * 100).toFixed(0)}%`);
  }
  console.log(`\nSugerencia (${n} temas para esta semana):`);
  ctx.sugerencia.forEach((s, i) => console.log(`  ${i + 1}. [${s.tema.id}] ${s.tema.titulo}\n     ${s.motivo}`));
  console.log("\n--- JSON ---");
  console.log(JSON.stringify(ctx.sugerencia.map((s) => ({ id: s.tema.id, titulo: s.tema.titulo, pilar: s.tema.pilar, formato: s.tema.formato, sensible: s.tema.sensible, fuentes_sugeridas: s.tema.fuentes_sugeridas })), null, 2));
}
