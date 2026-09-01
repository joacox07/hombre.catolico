/** Persiste el informe de render de una pieza modificada desde la Mesa editorial. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registrarRenderEnCalidad } from "../pipeline/calidad.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const archivo = process.argv[2];
  if (!archivo?.endsWith(".json")) throw new Error("Indicá el JSON de la pieza.");
  const ruta = resolve(ROOT, archivo);
  const pieza = JSON.parse(await readFile(ruta, "utf8"));
  const informe = JSON.parse(await readFile(join(ROOT, "out", pieza.id, "qa.json"), "utf8"));
  pieza.control_calidad = registrarRenderEnCalidad(
    pieza.control_calidad,
    informe.ok === true,
    Array.isArray(informe.errores) ? informe.errores.join(" ") : undefined,
  );
  await writeFile(ruta, JSON.stringify(pieza, null, 2) + "\n");
  if (!informe.ok) throw new Error(`El render técnico falló para ${pieza.id}.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
