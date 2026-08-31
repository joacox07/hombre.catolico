/**
 * Genera un ZIP por pieza: sus PNG listos para Instagram y un caption.txt.
 *
 * Uso:
 *   tsx scripts/empaquetar-lote.ts [data/lotes/lote-...json] [--render]
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

type Pieza = { id: string; caption?: string };
type Lote = { id?: string; semana: string; piezas: Array<{ ref: string }> };

async function leer<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(join(ROOT, rel.replace(/^\//, "")), "utf8")) as T;
}

async function loteActual(): Promise<string> {
  const indice = await leer<{ lotes: Array<{ file: string }> }>("data/lotes/index.json");
  if (!indice.lotes[0]) throw new Error("No hay lotes para empaquetar.");
  return indice.lotes[0].file;
}

async function main() {
  const args = process.argv.slice(2);
  const renderizar = args.includes("--render");
  const especificado = args.find((arg) => arg.endsWith(".json"));
  const archivo = especificado || await loteActual();
  const lote = await leer<Lote>(archivo);
  const loteId = lote.id || lote.semana;
  const piezas = await Promise.all(lote.piezas.map((meta) => leer<Pieza>(meta.ref)));

  if (renderizar) {
    execFileSync("npx", ["tsx", "scripts/render.ts", ...lote.piezas.map((meta) => meta.ref.replace(/^\//, ""))], {
      cwd: ROOT,
      stdio: "inherit",
    });
  }

  const destino = join(OUT, "descargas", loteId);
  await mkdir(destino, { recursive: true });
  for (const pieza of piezas) {
    const carpeta = join(OUT, pieza.id);
    if (!existsSync(carpeta)) throw new Error(`Faltan los PNG de ${pieza.id}. Usá --render.`);
    const pngs = (await readdir(carpeta))
      .filter((nombre) => nombre.endsWith(".png"))
      .sort()
      .map((nombre) => join(carpeta, nombre));
    if (!pngs.length) throw new Error(`No hay PNG para ${pieza.id}.`);

    const caption = join(destino, `${pieza.id}-caption.txt`);
    const zip = join(destino, `${pieza.id}.zip`);
    await writeFile(caption, (pieza.caption || "").trim() + "\n", "utf8");
    await unlink(zip).catch(() => undefined);
    execFileSync("zip", ["-j", "-q", zip, ...pngs, caption], { stdio: "inherit" });
    await unlink(caption);
    console.log(`✓ ${basename(zip)}`);
  }
  console.log(`\nDescargas listas en ${destino.replace(ROOT + "/", "")}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
