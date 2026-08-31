/**
 * Render de piezas a PNG (resolución Instagram 4:5, 1080×1350).
 *
 * Uso:
 *   npm run render:sample            → renderiza las piezas de data/muestras/
 *   npm run render -- <pieza.json>   → renderiza una pieza puntual
 *
 * Sirve el repo por http (servidor estático interno) y navega las plantillas, así las rutas
 * absolutas (/templates, /assets) resuelven igual que en el panel. Usa el Chromium de
 * Playwright ya instalado en el entorno (no descarga navegadores).
 */
import { chromium, type Browser, type Page } from "playwright";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { startServer, ROOT } from "./server.ts";

const OUT = join(ROOT, "out");
const CANVAS = { width: 1080, height: 1350 };

/** Resuelve el ejecutable de Chromium preinstalado en el entorno remoto (o deja que Playwright lo resuelva en local). */
function chromiumExecutable(): string | undefined {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/opt/pw-browsers/chromium",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p));
}

type Pieza = { id: string; tipo: "carrusel" | "cita"; slides?: unknown[]; [k: string]: unknown };

async function loadPieza(path: string): Promise<Pieza> {
  return JSON.parse(await readFile(path, "utf8")) as Pieza;
}

async function newPage(browser: Browser, baseUrl: string, template: string): Promise<Page> {
  const page = await browser.newPage({ viewport: CANVAS, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/templates/${template}`, { waitUntil: "networkidle" });
  return page;
}

async function renderCarrusel(browser: Browser, baseUrl: string, pieza: Pieza): Promise<string[]> {
  const page = await newPage(browser, baseUrl, "carrusel.html");
  const outDir = join(OUT, pieza.id);
  await mkdir(outDir, { recursive: true });
  const files: string[] = [];
  const n = (pieza.slides ?? []).length;
  for (let i = 0; i < n; i++) {
    await page.evaluate(([p, idx]) => (window as any).renderSlide(p, idx), [pieza, i] as const);
    await page.waitForTimeout(60);
    const file = join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await page.locator("#canvas").screenshot({ path: file });
    files.push(file);
  }
  await page.close();
  return files;
}

async function renderCita(browser: Browser, baseUrl: string, pieza: Pieza): Promise<string[]> {
  const page = await newPage(browser, baseUrl, "cita.html");
  const outDir = join(OUT, pieza.id);
  await mkdir(outDir, { recursive: true });
  await page.evaluate((p) => (window as any).renderCita(p), pieza);
  await page.waitForTimeout(60);
  const file = join(outDir, "cita.png");
  await page.locator("#canvas").screenshot({ path: file });
  await page.close();
  return [file];
}

async function renderPieza(browser: Browser, baseUrl: string, pieza: Pieza): Promise<string[]> {
  return pieza.tipo === "cita"
    ? renderCita(browser, baseUrl, pieza)
    : renderCarrusel(browser, baseUrl, pieza);
}

async function main() {
  const args = process.argv.slice(2);
  const paths: string[] = [];

  if (args.includes("--sample")) {
    const dir = join(ROOT, "data", "muestras");
    for (const f of await readdir(dir)) if (f.endsWith(".json")) paths.push(join(dir, f));
  } else {
    for (const a of args) if (a.endsWith(".json")) paths.push(resolve(a));
  }

  if (paths.length === 0) {
    console.error("Nada para renderizar. Usá --sample o pasá un archivo .json de pieza.");
    process.exit(1);
  }

  const { server, url } = await startServer(0);
  const executablePath = chromiumExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    for (const p of paths) {
      const pieza = await loadPieza(p);
      const files = await renderPieza(browser, url, pieza);
      console.log(`✓ ${pieza.id} (${pieza.tipo}) → ${files.length} imagen(es)`);
      for (const f of files) console.log(`    ${f.replace(ROOT + "/", "")}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\nListo. Salida en ${OUT.replace(ROOT + "/", "")}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
