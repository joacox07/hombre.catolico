/**
 * Render de piezas a PNG (resolución Instagram 4:5, 1080×1350).
 *
 * Uso:
 *   npm run render:sample            → renderiza las piezas de data/muestras/
 *   npm run render -- <pieza.json>   → renderiza una pieza puntual
 *
 * Usa el Chromium de Playwright ya instalado en el entorno (no descarga navegadores).
 * La misma plantilla HTML que se usa acá es la que mostrará el panel: la previsualización
 * es la pieza real, no una simulación.
 */
import { chromium, type Browser, type Page } from "playwright";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

/**
 * Resuelve el ejecutable de Chromium. En este entorno remoto el navegador ya viene
 * instalado en /opt/pw-browsers (puede diferir la versión del paquete npm), así que
 * apuntamos al binario directo. En local, dejamos que Playwright lo resuelva solo.
 */
function chromiumExecutable(): string | undefined {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/opt/pw-browsers/chromium",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TEMPLATES = join(ROOT, "templates");
const OUT = join(ROOT, "out");

const CANVAS = { width: 1080, height: 1350 };

type Pieza = {
  id: string;
  tipo: "carrusel" | "cita";
  slides?: unknown[];
  [k: string]: unknown;
};

async function loadPieza(path: string): Promise<Pieza> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as Pieza;
}

async function newPage(browser: Browser, template: string): Promise<Page> {
  const page = await browser.newPage({ viewport: CANVAS, deviceScaleFactor: 1 });
  const url = "file://" + join(TEMPLATES, template);
  await page.goto(url, { waitUntil: "networkidle" });
  return page;
}

async function renderCarrusel(browser: Browser, pieza: Pieza): Promise<string[]> {
  const page = await newPage(browser, "carrusel.html");
  const outDir = join(OUT, pieza.id);
  await mkdir(outDir, { recursive: true });
  const files: string[] = [];
  const n = (pieza.slides ?? []).length;
  for (let i = 0; i < n; i++) {
    await page.evaluate(
      ([p, idx]) => (window as any).renderSlide(p, idx),
      [pieza, i] as const,
    );
    await page.waitForTimeout(60);
    const file = join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await page.locator("#canvas").screenshot({ path: file });
    files.push(file);
  }
  await page.close();
  return files;
}

async function renderCita(browser: Browser, pieza: Pieza): Promise<string[]> {
  const page = await newPage(browser, "cita.html");
  const outDir = join(OUT, pieza.id);
  await mkdir(outDir, { recursive: true });
  await page.evaluate((p) => (window as any).renderCita(p), pieza);
  await page.waitForTimeout(60);
  const file = join(outDir, "cita.png");
  await page.locator("#canvas").screenshot({ path: file });
  await page.close();
  return [file];
}

async function renderPieza(browser: Browser, pieza: Pieza): Promise<string[]> {
  if (pieza.tipo === "cita") return renderCita(browser, pieza);
  return renderCarrusel(browser, pieza);
}

async function main() {
  const args = process.argv.slice(2);
  const sample = args.includes("--sample");
  const paths: string[] = [];

  if (sample) {
    const dir = join(ROOT, "data", "muestras");
    for (const f of await readdir(dir)) {
      if (f.endsWith(".json")) paths.push(join(dir, f));
    }
  } else {
    for (const a of args) if (a.endsWith(".json")) paths.push(resolve(a));
  }

  if (paths.length === 0) {
    console.error("Nada para renderizar. Usá --sample o pasá un archivo .json de pieza.");
    process.exit(1);
  }

  const executablePath = chromiumExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    for (const p of paths) {
      const pieza = await loadPieza(p);
      const files = await renderPieza(browser, pieza);
      console.log(`✓ ${pieza.id} (${pieza.tipo}) → ${files.length} imagen(es)`);
      for (const f of files) console.log(`    ${f.replace(ROOT + "/", "")}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`\nListo. Salida en ${OUT.replace(ROOT + "/", "")}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
