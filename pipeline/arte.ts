/** Resuelve el "plan de arte" de una pieza → produce la imagen (descarga PD o genera con IA),
 *  la guarda en assets/arte/{descargado|generado}/ con procedencia, y setea pieza.arte.
 *  Requiere red abierta (Actions) para descarga/IA. */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { imagen as generarImagenOpenAI } from "./openai.ts";
import { descargarObra } from "./arte-descarga.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTE = join(ROOT, "assets", "arte");

// Estilo forzado para toda imagen IA: coherente con el tratamiento y con los guardarraíles.
const ESTILO_IA =
  "pintura al óleo clásica, claroscuro cálido y tenebrismo, atmósfera sacra sobria y solemne, " +
  "paleta parda y dorada, luz de vela; SIN texto, SIN palabras, SIN letras; " +
  "sin rostros de santos identificables; composición vertical con espacio para texto abajo.";

export interface ArtePlan {
  fuente: "descarga" | "ia" | "curada";
  query?: string;   // para descarga
  prompt?: string;  // para ia
  archivo?: string; // para curada (ya en assets/arte/)
}

/** Mutará pieza.arte y escribirá archivos. Devuelve la pieza. */
export async function resolverArte(pieza: any): Promise<any> {
  const plan: ArtePlan | undefined = pieza.arte_plan;
  if (!plan) throw new Error(`Falta arte_plan en ${pieza.id}; una pieza final requiere imagen.`);

  if (plan.fuente === "curada" && plan.archivo) {
    pieza.arte = { fuente: "curada", archivo: plan.archivo, verificado: false };
    return pieza;
  }

  if (plan.fuente === "descarga") {
    if (!plan.query) throw new Error(`arte_plan.descarga sin query en ${pieza.id}`);
    const obra = await descargarObra(plan.query);
    const rel = `descargado/${pieza.id}.${obra.ext}`;
    await mkdir(join(ARTE, "descargado"), { recursive: true });
    await writeFile(join(ARTE, rel), obra.buffer);
    await writeFile(join(ARTE, rel + ".json"), JSON.stringify({ ...obra.procedencia, verificado: false }, null, 2) + "\n");
    pieza.arte = { fuente: "descarga", archivo: rel, credito: obra.procedencia.titulo, licencia: obra.procedencia.licencia, verificado: false };
    return pieza;
  }

  if (plan.fuente === "ia") {
    if (!plan.prompt) throw new Error(`arte_plan.ia sin prompt en ${pieza.id}`);
    const prompt = `${plan.prompt}. ${ESTILO_IA}`;
    const png = await generarImagenOpenAI(prompt);
    const rel = `generado/${pieza.id}.png`;
    await mkdir(join(ARTE, "generado"), { recursive: true });
    await writeFile(join(ARTE, rel), png);
    await writeFile(join(ARTE, rel + ".json"), JSON.stringify({ fuente: "ia", modelo: process.env.IMAGEN_MODEL || "gpt-image-1", prompt, licencia: "Generada por IA (no es obra histórica)", verificado: false }, null, 2) + "\n");
    pieza.arte = { fuente: "ia", archivo: rel, prompt, verificado: false };
    return pieza;
  }

  return pieza;
}
